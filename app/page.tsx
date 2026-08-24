import type { Metadata } from "next";
import { headers } from "next/headers";
import { ProjectionExperience } from "./ProjectionExperience";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const origin = `${protocol}://${host}`;
  const title = "Sphere to ERP — Interactive Projection";
  const description =
    "An interactive computer vision visualization of a spherical environment map unfolding into its equirectangular parameterization.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: new URL("/og.png", origin).toString(), width: 1672, height: 941 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [new URL("/og.png", origin).toString()],
    },
  };
}

export default function Home() {
  return <ProjectionExperience />;
}
