import type { Locale } from "./locale";

/**
 * Los errores de la API llegan con un `code` y un mensaje en español. En inglés, el cliente (web
 * y app) enseña el de esta tabla; si el código no está, uno genérico (nunca el español).
 */
const EN: Record<string, string> = {
  network: "Couldn't reach the server. Check your connection.",
  internal: "Unexpected server error. Try again in a moment.",
  http: "Something went wrong. Try again.",
  unauthorized: "Sign in to continue.",
  rate_limited: "You're going too fast: wait a minute and try again.",
  too_large: "What you sent is too big.",
  bad_json: "The request isn't valid JSON.",
  invalid_request: "Some of the data sent isn't valid.",
  invalid_pref: "Unknown or invalid preference.",
  not_found: "Not found (or you can't see it).",
  forbidden: "You can't do that.",
  password_required: "Enter your password to confirm.",
  wrong_password: "That password isn't correct.",
  stale_session: "For security, sign out and back in before deleting your account.",
  confirm_mismatch: "The email you typed doesn't match your account.",
  // Mazos
  deck_not_found: "That deck doesn't exist or you can't see it.",
  no_commander: "The list doesn't say who the commander is. Choose it in the analyzer.",
  unsupported_input: "Paste a decklist or the link to a public deck.",
  invalid_commander: "That card can't be a commander.",
  invalid_commanders: "Those cards can't be commanders together.",
  not_commander: "That card can't be a commander.",
  no_collection: "To build it with your cards I need your collection.",
  is_commander: "That card is this deck's commander.",
  off_color: "That card is outside the commander's color identity.",
  already_in_deck: "That card is already in the deck with all the copies allowed.",
  not_in_deck: "That card isn't in the deck.",
  invalid_printing: "That printing isn't of this card.",
  empty_catalog: "The card catalog is empty. Try again later.",
  invalid_csv: "That doesn't look like a collection CSV.",
  // Datos de la comunidad y combos
  edhrec_not_found: "There's no community data for that commander (or theme) yet.",
  edhrec_blocked: "Community data is unavailable right now. Try again later.",
  edhrec_unavailable: "Community data is unavailable right now. Try again later.",
  edhrec_format: "Community data came back in an unexpected format. Try again later.",
  edhrec_invalid_query: "That commander or theme isn't valid.",
  combos_blocked: "Combos are unavailable right now. Try again later.",
  combos_unavailable: "Combos are unavailable right now. Try again later.",
  combos_format: "Combos came back in an unexpected format. Try again later.",
  // Enlaces de mazos públicos
  moxfield_not_found: "That deck link doesn't exist or isn't public.",
  moxfield_blocked:
    "That site isn't letting us read the deck. Export the list as text and paste it.",
  moxfield_unavailable: "Couldn't read that deck link. Export the list as text and paste it.",
  moxfield_format: "Couldn't read that deck link. Export the list as text and paste it.",
  archidekt_not_found: "That deck link doesn't exist or isn't public.",
  archidekt_blocked:
    "That site isn't letting us read the deck. Export the list as text and paste it.",
  archidekt_unavailable: "Couldn't read that deck link. Export the list as text and paste it.",
  archidekt_format: "Couldn't read that deck link. Export the list as text and paste it.",
  // Gente
  user_not_found: "That user doesn't exist.",
  username_format: "3 to 20 letters, numbers or underscores, starting with a letter.",
  username_reserved: "That username is reserved.",
  username_taken: "That username is already taken.",
  follow_self: "You can't follow yourself.",
  block_self: "You can't block yourself.",
  blocked: "You can't do that with this person.",
  // Comentarios
  comments_closed: "This deck doesn't allow comments.",
  too_fast: "Wait a few seconds before commenting again.",
  own_comment: "You can't report yourself.",
  comment_empty: "The comment is empty.",
  comment_too_long: "The comment is too long.",
  comment_too_many_links: "Too many links in the comment.",
  // Grupos, partidas y préstamos
  invalid_name: "Give the group a name.",
  group_full: "The group is full.",
  too_many_groups: "You're in too many groups.",
  owner_leaves: "The group's creator can't leave it: they can delete it.",
  invalid_game: "That game isn't valid. Check the players, decks and winner.",
  invalid_loan: "Who are you lending it to?",
  not_free: "You don't have that many free copies (the rest are in decks or lent).",
  // Intercambios
  trade_not_found: "That trade doesn't exist or you can't see it.",
  trade_private: "This person's trade lists are private.",
  trade_self: "You can't trade with yourself.",
  trade_forbidden: "You can't do that with this proposal.",
  trade_not_your_turn: "It's not your turn to answer.",
  trade_closed: "This proposal is already closed.",
  trade_empty: "The proposal has no cards.",
  trade_unavailable: "Some cards are no longer available for trade.",
  trade_missing_copies: "Someone no longer has some of the copies: nothing has been moved.",
  trade_blocked: "You can't trade with this person.",
  collection_private: "This collection is private.",
};

/** El mensaje de un error de la API en el idioma de la página. */
export function apiErrorMessage(code: string, message: string, locale: Locale): string {
  if (locale !== "en") return message;
  return EN[code] ?? "Something went wrong. Try again.";
}
