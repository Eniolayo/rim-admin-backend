import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminUser } from '../../../entities/admin-user.entity';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AdminUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

