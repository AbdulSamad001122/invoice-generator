import { auth } from "@clerk/nextjs/server";
import HomeClient from "./home-client";

// The home page asks the server (from the session cookie) whether the visitor is
// signed in, so it can render the dashboard or the landing page straight away
// instead of showing a spinner until Clerk loads in the browser.
export default async function Home() {
  const { userId } = await auth();
  return <HomeClient serverSignedIn={Boolean(userId)} />;
}
