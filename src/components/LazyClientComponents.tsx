"use client";

// `ssr: false` is only valid inside Client Components (Next.js restriction).
// This wrapper is the single place where all browser-only lazy imports live.
// layout.tsx (a Server Component) imports this one component instead.

import dynamic from "next/dynamic";

const SdkDevMock = dynamic(() => import("./SdkDevMock"), { ssr: false });
const SignerInit = dynamic(() => import("./SignerInit"), { ssr: false });
const WelcomeModal = dynamic(() => import("./WelcomeModal"), { ssr: false });
const PushNotificationSetup = dynamic(() => import("./PushNotificationSetup"), { ssr: false });
const MiniAppViewer = dynamic(() => import("./MiniAppViewer"), { ssr: false });
const UpdateBanner = dynamic(() => import("./UpdateBanner"), { ssr: false });
const FarcasterOnboarding = dynamic(() => import("./FarcasterOnboarding"), { ssr: false });
const ComposeModal = dynamic(() => import("./ComposeModal"), { ssr: false });
const ScheduledCastsModal = dynamic(() => import("./ScheduledCastsModal"), { ssr: false });

export default function LazyClientComponents() {
  return (
    <>
      <SdkDevMock />
      <SignerInit />
      <WelcomeModal />
      <PushNotificationSetup />
      <MiniAppViewer />
      <UpdateBanner />
      <FarcasterOnboarding />
      <ComposeModal />
      <ScheduledCastsModal />
    </>
  );
}
