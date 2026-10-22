import { SignInClient } from "./signin-client";
import { telegramBotUsername, telegramLoginConfigured } from "@/lib/telegram-login";

/**
 * Server shell around the sign-in form.
 *
 * Its only job is to read the bot username, which lives in the same
 * TELEGRAM_BOT_USERNAME the broadcaster uses. Passing it down beats publishing a
 * second NEXT_PUBLIC_ copy: one variable to set, and no way for the two to
 * disagree. Null when Telegram isn't configured, and the button doesn't render.
 */
export default function SignInPage() {
  return <SignInClient telegramBot={telegramLoginConfigured() ? telegramBotUsername() : null} />;
}
