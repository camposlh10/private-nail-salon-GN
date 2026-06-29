import { Suspense } from "react";
import { BookingConfirmationPage } from "@/components/BookingConfirmationPage";

export default function Page() {
  return (
    <Suspense>
      <BookingConfirmationPage />
    </Suspense>
  );
}
