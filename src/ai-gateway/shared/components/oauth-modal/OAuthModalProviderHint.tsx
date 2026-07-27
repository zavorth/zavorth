import { isGoogleOAuthProvider } from "./oauthModalUtils";

type OAuthModalProviderHintProps = {
  isTrueLocalhost: boolean;
  provider?: string;
};

export function OAuthModalProviderHint({
  isTrueLocalhost,
  provider,
}: OAuthModalProviderHintProps) {
  if (isTrueLocalhost) {
    return null;
  }

  if (isGoogleOAuthProvider(provider)) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        <span className="material-symbols-outlined text-sm align-middle mr-1">warning</span>
        <strong>Remote access + Google OAuth:</strong> The default credentials only accept
        redirects to <code>localhost</code>. After authorizing, your browser will try to open{" "}
        <code>localhost</code> ? copy that full URL and paste it below. For fully remote use
        without this manual step,{" "}
        <a
          href="https://github.com/greyvritra/zavorth#oauth-on-a-remote-server"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          configure your own OAuth credentials
        </a>
        .
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">
      <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
      <strong>Remote access:</strong> Since you&after;re accessing Zavorth remotely, after
      authorizing you&after;ll see an error page (localhost not found). That&after;s expected - just
      copy the full URL from your browser&after;s address bar and paste it below.
    </div>
  );
}
