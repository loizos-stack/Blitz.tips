import { SignUpClient } from "./signup-client";
import { telegramBotUsername, telegramLoginConfigured } from "@/lib/telegram-login";

/**
 * Server shell around the sign-up flow — see the sign-in page for why the bot
 * username is read here rather than published as a second env var.
 */
export default function SignUpPage() {
  return <SignUpClient telegramBot={telegramLoginConfigured() ? telegramBotUsername() : null} />;
}
