import type { Metadata } from "next";
import AxionClient from "./AxionClient";

export const metadata: Metadata = {
  title: "Rekenmachine",
  description:
    "De Axion algebra rekenmachine combineert exacte en numerieke resultaten met een retro-futuristisch thema.",
};

export default function AxionPage() {
  return <AxionClient />;
}
