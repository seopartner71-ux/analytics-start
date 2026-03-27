import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code && window.opener) {
      window.opener.postMessage({ type: "yandex-oauth-callback", code }, window.location.origin);
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-muted-foreground">Авторизация... Окно закроется автоматически.</p>
    </div>
  );
}
