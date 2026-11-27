import { PAYMENT_MARKS, type PaymentMark } from "@/components/payment-marks";

/**
 * The payment strip above the footer: who processes the money, and what a
 * reader can actually pay with.
 *
 * The list is not decorative. Every mark here corresponds to a payment method
 * that is live on the Stripe account (`available: true` on the default payment
 * method configuration) or to crypto, which runs through NOWPayments. A strip
 * advertising a method the checkout then doesn't offer is worse than no strip
 * at all — it reads as a bait, and it is the kind of thing a reader notices at
 * exactly the moment they were deciding whether to trust the site.
 *
 * So when a method is turned on or off in the Stripe Dashboard, this list is
 * what has to change with it.
 *
 * Omitted on purpose, though they are enabled: the local rails that only a
 * small, specific audience can use (BLIK, Satispay, MB WAY, Multibanco, TWINT,
 * MobilePay, Bancontact, EPS, and the Korean wallets). Stripe shows each of
 * them to the customers they apply to; printing all twenty-odd here would turn
 * a trust signal into wallpaper.
 */

const CARDS = [PAYMENT_MARKS.visa, PAYMENT_MARKS.mastercard, PAYMENT_MARKS.americanexpress];
const WALLETS = [PAYMENT_MARKS.applepay, PAYMENT_MARKS.googlepay];
const BANK = [PAYMENT_MARKS.sepa, PAYMENT_MARKS.klarna, PAYMENT_MARKS.revolut, PAYMENT_MARKS.pix];
const CRYPTO = [PAYMENT_MARKS.bitcoin, PAYMENT_MARKS.ethereum, PAYMENT_MARKS.tether];

/**
 * One mark in a tile.
 *
 * `title` gives the hover tooltip and `aria-label` the accessible name, so the
 * strip is not a row of anonymous shapes to a screen reader. The tile itself is
 * `aria-hidden`-free on purpose: "Visa" is information, not decoration.
 */
function Mark({ mark }: { mark: PaymentMark }) {
  return (
    <span
      title={mark.label}
      className="flex h-10 w-16 items-center justify-center rounded-lg border border-border bg-surface-raised text-muted transition-colors hover:text-foreground"
    >
      <svg
        role="img"
        aria-label={mark.label}
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="currentColor"
      >
        <title>{mark.label}</title>
        <path d={mark.d} />
      </svg>
    </span>
  );
}

function Group({ marks }: { marks: readonly PaymentMark[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {marks.map((mark) => (
        <Mark key={mark.id} mark={mark} />
      ))}
    </div>
  );
}

export function PaymentMethods() {
  return (
    <section
      aria-labelledby="payment-methods-heading"
      className="border-t border-border bg-surface"
    >
      <div className="container-page py-10">
        <h2
          id="payment-methods-heading"
          className="text-center text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Payment methods we accept
        </h2>

        {/* The groups are separated rather than run together so the row reads as
            four kinds of thing — cards, wallets, bank and buy-now-pay-later,
            crypto — instead of twelve logos in a line. The dividers are hidden
            on small screens, where the groups stack and the gap does the work. */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
          <Group marks={CARDS} />
          <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
          <Group marks={WALLETS} />
          <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
          <Group marks={BANK} />
          <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
          <Group marks={CRYPTO} />
        </div>

        {/* Running text, not a flex row: as a flex row the container gap landed
            on top of the sentence's own spaces and printed a double space
            after "Stripe". */}
        <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-relaxed text-muted">
          Payments are processed by{" "}
          <span className="inline-flex items-center gap-1 align-middle font-medium text-foreground">
            <svg role="img" aria-label="Stripe" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <title>Stripe</title>
              <path d={PAYMENT_MARKS.stripe.d} />
            </svg>
            Stripe
          </span>{" "}
          and NOWPayments.{" "}
          {/* Worth stating plainly rather than implying it with a padlock icon:
              the card number never touches this site, so "we were breached" and
              "your card is exposed" are different events here. */}
          Blitz.tips never sees or stores your card details.
        </p>
      </div>
    </section>
  );
}
