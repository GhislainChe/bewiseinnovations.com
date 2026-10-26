import { confirmationInput } from "./confirmation-input";

export type FragmentWindow = {
  location: { pathname: string; search: string; hash: string };
  history: { replaceState(data: unknown, unused: string, url: string): void };
  __beWiseConfirmation?: () => string;
};

/** Static script: no interpolation, bundler helper dependencies, network or storage. */
export const CONFIRMATION_FRAGMENT_BOOTSTRAP = `(function () {
  var target = window;
  if (target.location.pathname !== "/auth/confirm") return;
  var fragment = target.location.search ? "" : target.location.hash.slice(1);
  try { target.history.replaceState(null, "", "/auth/confirm"); }
  catch (_) { fragment = ""; }
  Object.defineProperty(target, "__beWiseConfirmation", { configurable: true, value: function () {
    var value = fragment;
    fragment = "";
    delete target.__beWiseConfirmation;
    return value;
  } });
  target.addEventListener && target.addEventListener("pagehide", function () {
    fragment = "";
    delete target.__beWiseConfirmation;
  }, { once: true });
})();`;

export function readConfirmationFragment(fragment: string) {
  const params = new URLSearchParams(fragment);
  if (params.getAll("token_hash").length !== 1 || params.getAll("type").length !== 1 ||
    [...params.keys()].some(key => key !== "token_hash" && key !== "type")) return null;
  const input = confirmationInput(params.get("token_hash"), params.get("type"));
  return input.ok ? input : null;
}
