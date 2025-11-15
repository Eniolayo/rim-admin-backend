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
import { AdminActivityLogRepository } from '../repositories/activity.repository';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { AdminUser } from '../../../entities/admin-user.entity';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  constructor(
    private readonly activityLogRepository: AdminActivityLogRepository,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, params, body } = request;

    // Check if route matches /admin/invitations pattern
    if (!url.includes('/admin/invitations')) {
      return next.handle();
    }

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

    // Determine action and resource from route
    // Remove query string and API prefix for matching
    const urlPath = url.split('?')[0];
    const isCreateRoute =
      method === 'POST' &&
      (urlPath === '/admin/invitations' ||
        urlPath.endsWith('/admin/invitations'));
    const isResendRoute = method === 'POST' && urlPath.includes('/resend');
    const isDeleteRoute = method === 'DELETE';

    let action: string;
    let resourceId: string | null = null;
    let details: Record<string, unknown> | null = null;

    if (isCreateRoute) {
      // Create invitation
      action = 'create';
      details = { email: body?.email, role: body?.role };
    } else if (isResendRoute) {
      // Resend invitation
      action = 'resend';
      resourceId = params?.id || null;
    } else if (isDeleteRoute) {
      // Delete/cancel invitation
      action = 'delete';
      resourceId = params?.id || null;
    } else {
      // Unknown action, skip logging
      return next.handle();
    }

    // Log after successful response
    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          // Only log on successful responses (2xx)
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              // Extract resourceId from response for create action
              if (action === 'create' && responseData?.id) {
                resourceId = responseData.id;
              }

              await this.activityLogRepository.create({
                adminId: user.id,
                adminName: user.username,
                action,
                resource: 'invitation',
                resourceId,
                details,
                ipAddress,
              });

              this.logger.debug(
                `Activity logged: ${action} invitation by ${user.username}`,
              );
            } catch (error) {
              // Don't break request flow if logging fails
              this.logger.error(
                `Failed to log activity: ${error.message}`,
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

