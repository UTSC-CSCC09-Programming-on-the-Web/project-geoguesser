export interface CurrentUser {
  userId: number;
  email: string;
  username: string;
  subscriptionStatus: string;
}

export interface CurrentUserResponse {
  user: CurrentUser;
}

export interface CheckoutResponse {
  url: string;
}
