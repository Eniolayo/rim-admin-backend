import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityQueueService } from '../services/activity-queue.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';

interface RoutePattern {
  resource: string;
  patterns: Array<{
    method: string;
    pathPattern: RegExp;
    action: string;
    extractResourceId?: (params: any, body: any, url: string) => string | null;
    extractDetails?: (body: any, params: any) => Record<string, unknown> | null;
  }>;
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  // Define route patterns for all resources we want to track
  private readonly routePatterns: RoutePattern[] = [
    // Loans
    {
      resource: 'loan',
      patterns: [
        {
          method: 'POST',
          pathPattern: /\/loans\/create$/,
          action: 'create',
          extractResourceId: (_, __, ___) => null,
          extractDetails: (body) => ({
            amount: body?.amount,
            userId: body?.userId,
          }),
        },
        {
          method: 'PATCH',
          pathPattern: /\/loans\/([^/]+)$/,
          action: 'update',
          extractResourceId: (params) => params?.id || null,
          extractDetails: (body) => (body ? { ...body } : null),
        },
        {
          method: 'POST',
          pathPattern: /\/loans\/approve$/,
          action: 'approve',
          extractResourceId: (_, body) => body?.loanId || null,
          extractDetails: (body) => ({ loanId: body?.loanId }),
        },
        {
          method: 'POST',
          pathPattern: /\/loans\/reject$/,
          action: 'reject',
          extractResourceId: (_, body) => body?.loanId || null,
          extractDetails: (body) => ({ loanId: body?.loanId }),
        },
        {
          method: 'POST',
          pathPattern: /\/loans\/([^/]+)\/disburse$/,
          action: 'disburse',
          extractResourceId: (params) => params?.id || null,
        },
        {
          method: 'DELETE',
          pathPattern: /\/loans\/([^/]+)$/,
          action: 'delete',
          extractResourceId: (params) => params?.id || null,
        },
      ],
    },
    // Transactions
    {
      resource: 'transaction',
      patterns: [
        {
          method: 'POST',
          pathPattern: /\/transactions\/reconcile$/,
          action: 'reconcile',
          extractResourceId: (_, body) => body?.transactionId || null,
          extractDetails: (body) => ({ transactionId: body?.transactionId }),
        },
      ],
    },
    // Users
    {
      resource: 'user',
      patterns: [
        {
          method: 'POST',
          pathPattern: /\/users$/,
          action: 'create',
          extractResourceId: (_, __, ___) => null,
          extractDetails: (body) => ({
            phone: body?.phone,
            email: body?.email,
          }),
        },
        {
          method: 'PATCH',
          pathPattern: /\/users\/([^/]+)$/,
          action: 'update',
          extractResourceId: (params) => params?.id || null,
          extractDetails: (body) => (body ? { ...body } : null),
        },
        {
          method: 'PATCH',
          pathPattern: /\/users\/([^/]+)\/status$/,
          action: 'update_status',
          extractResourceId: (params) => params?.id || null,
          extractDetails: (body) => ({ status: body?.status }),
        },
        {
          method: 'PATCH',
          pathPattern: /\/users\/([^/]+)\/credit-limit$/,
          action: 'update_credit_limit',
          extractResourceId: (params) => params?.id || null,
          extractDetails: (body) => ({
            creditLimit: body?.creditLimit,
            autoLimitEnabled: body?.autoLimitEnabled,
          }),
        },
        {
          method: 'POST',
          pathPattern: /\/users\/bulk\/status$/,
          action: 'bulk_update_status',
          extractResourceId: (_, __, ___) => null,
          extractDetails: (body) => ({ ids: body?.ids, status: body?.status }),
        },
        {
          method: 'DELETE',
          pathPattern: /\/users\/([^/]+)$/,
          action: 'delete',
          extractResourceId: (params) => params?.id || null,
        },
      ],
    },
    // Roles
    {
      resource: 'role',
      patterns: [
        {
          method: 'POST',
          pathPattern: /\/admin\/roles$/,
          action: 'create',
          extractResourceId: (_, __, ___) => null,
          extractDetails: (body) => ({
            name: body?.name,
            description: body?.description,
          }),
        },
        {
          method: 'PATCH',
          pathPattern: /\/admin\/roles\/([^/]+)$/,
          action: 'update',
          extractResourceId: (params) => params?.id || null,
          extractDetails: (body) => (body ? { ...body } : null),
        },
        {
          method: 'DELETE',
          pathPattern: /\/admin\/roles\/([^/]+)$/,
          action: 'delete',
          extractResourceId: (params) => params?.id || null,
        },
      ],
    },
    // Invitations
    {
      resource: 'invitation',
      patterns: [
        {
          method: 'POST',
          pathPattern: /\/admin\/invitations\/invite$/,
          action: 'create',
          extractResourceId: (_, __, ___) => null,
          extractDetails: (body) => ({ email: body?.email, role: body?.role }),
        },
        {
          method: 'POST',
          pathPattern: /\/admin\/invitations\/([^/]+)\/resend$/,
          action: 'resend',
          extractResourceId: (params) => params?.id || null,
        },
        {
          method: 'DELETE',
          pathPattern: /\/admin\/invitations\/([^/]+)$/,
          action: 'delete',
          extractResourceId: (params) => params?.id || null,
        },
      ],
    },
    // Admin Users
    {
      resource: 'admin-user',
      patterns: [
        {
          method: 'PATCH',
          pathPattern: /\/admin\/users\/([^/]+)\/status$/,
          action: 'update_status',
          extractResourceId: (params) => params?.id || null,
          extractDetails: (body) => ({ status: body?.status }),
        },
      ],
    },
    // Settings
    {
      resource: 'settings',
      patterns: [
        {
          method: 'PUT',
          pathPattern: /\/admin\/settings\/2fa$/,
          action: 'update_2fa',
          extractResourceId: (_, __, ___) => null,
          extractDetails: (body) => (body ? { ...body } : null),
        },
      ],
    },
  ];

  constructor(
    private readonly activityQueueService: ActivityQueueService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, params, body } = request;

    // Skip GET requests (read-only operations)
    if (method === 'GET') {
      return next.handle();
    }

    // Skip public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return next.handle();
    }

    // Extract user from request (set by JwtAuthGuard)
    const user: AdminUser | undefined = request.user;

    // Skip if no user (shouldn't happen for protected routes, but safety check)
    if (!user) {
      return next.handle();
    }

    // Extract IP address
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.connection?.remoteAddress ||
      null;

    // Remove query string and API prefix for matching
    const urlPath = url.split('?')[0].replace(/^\/api/, '');

    // Find matching route pattern
    let matchedPattern: {
      resource: string;
      action: string;
      extractResourceId?: Function;
      extractDetails?: Function;
    } | null = null;

    for (const routePattern of this.routePatterns) {
      for (const pattern of routePattern.patterns) {
        if (pattern.method === method && pattern.pathPattern.test(urlPath)) {
          matchedPattern = {
            resource: routePattern.resource,
            action: pattern.action,
            extractResourceId: pattern.extractResourceId,
            extractDetails: pattern.extractDetails,
          };
          break;
        }
      }
      if (matchedPattern) break;
    }

    // If no pattern matched, skip logging
    if (!matchedPattern) {
      return next.handle();
    }

    // Extract resourceId and details
    let resourceId: string | null = null;
    let details: Record<string, unknown> | null = null;

    if (matchedPattern.extractResourceId) {
      resourceId =
        matchedPattern.extractResourceId(params, body, urlPath) || null;
    }

    if (matchedPattern.extractDetails) {
      details = matchedPattern.extractDetails(body, params) || null;
    }

    // Log after successful response
    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          // Only log on successful responses (2xx)
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              // Extract resourceId from response for create actions if not already set
              if (!resourceId && responseData?.id) {
                resourceId = responseData.id;
              }

              // Enqueue to queue (non-blocking, fire-and-forget)
              await this.activityQueueService.enqueue({
                adminId: user.id,
                adminName: user.username,
                action: matchedPattern!.action,
                resource: matchedPattern!.resource,
                resourceId,
                details,
                ipAddress,
              });

              this.logger.debug(
                `Activity logged: ${matchedPattern!.action} ${matchedPattern!.resource} by ${user.username}`,
              );
            } catch (error) {
              // Don't break request flow if logging fails
              this.logger.error(
                `Failed to enqueue activity log: ${error.message}`,
                error.stack,
              );
            }
          }
        },
        error: (error) => {
          // Don't log failed requests
          throw error;
        },
      }),
    );
  }
}
