import { BookOpen, WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BookOpen className="size-7" />
        </div>
        <div className="mb-3 flex items-center justify-center gap-2 text-muted-foreground">
          <WifiOff className="size-4" />
          <span className="text-sm">لا يوجد اتصال بالإنترنت</span>
        </div>
        <h1 className="text-2xl font-bold">وِردي</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          الصفحات التي فتحتها سابقًا قد تبقى متاحة. أعد الاتصال لتحميل تلاوات وصفحات جديدة.
        </p>
      </div>
    </main>
  )
}
