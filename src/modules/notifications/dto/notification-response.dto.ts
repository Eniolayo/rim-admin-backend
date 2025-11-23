import { NotificationType, NotificationStatus, RelatedEntityType } from '../../../entities/notification.entity';

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipientId: string;
  status: NotificationStatus;
  readAt: Date | null;
  relatedEntityType: RelatedEntityType | null;
  relatedEntityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

