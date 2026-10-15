import { Suspense } from "react";
import { HuaweiCartsPage } from "@/components/huawei-carts/huawei-carts-page";
export default function Page() {
  return (
    <Suspense>
      <HuaweiCartsPage />
    </Suspense>
  );
}
