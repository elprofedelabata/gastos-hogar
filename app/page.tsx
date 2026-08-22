import type { Metadata } from "next";
import { HouseholdApp } from "./household-app";

export const metadata: Metadata = {
  title: "Mi casa · Gastos del hogar",
  description: "Control compartido de gastos y balances del hogar.",
};

export default function Home() {
  return <HouseholdApp />;
}
