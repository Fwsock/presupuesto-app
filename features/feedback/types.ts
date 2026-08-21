export type FeedbackCategory = 'bug' | 'suggestion';

export interface Feedback {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string;
  title: string;
  category: FeedbackCategory;
  description: string;
  image_url: string | null;
  device_info: string | null;
}

export interface NewFeedbackInput {
  title: string;
  category: FeedbackCategory;
  description: string;
  /** Local file URI from the camera/gallery picker, if the user attached evidence -- uploaded to Storage before the row is inserted. */
  imageUri: string | null;
}
