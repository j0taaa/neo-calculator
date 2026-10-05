import { redirect } from "next/navigation";
import { synchronizedRedirect } from "@/lib/huawei-native/legacy-product";

export default async function RetiredCalculator({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(synchronizedRedirect(await searchParams));
}
