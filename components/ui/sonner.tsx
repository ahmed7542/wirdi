"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      dir="rtl"
      toastOptions={{
        classNames: {
          toast: "group toast relative !w-[min(17rem,calc(100vw-1rem))] !min-h-0 !gap-1.5 overflow-hidden !rounded-md !border !border-primary/20 !bg-card/95 !px-2.5 !py-2 !text-card-foreground wird-toast-shell backdrop-blur-md",
          title: "text-right !text-[11px] !font-semibold !leading-4 sm:!text-xs",
          description: "text-right !text-[10px] !leading-4 !text-muted-foreground sm:!text-[11px]",
          icon: "!ms-0 !me-0.5 !size-4 !shrink-0 !text-primary",
          actionButton: "!h-7 !rounded-sm !bg-primary !px-2.5 !text-xs !text-primary-foreground",
          cancelButton: "!h-7 !rounded-sm !bg-muted !px-2.5 !text-xs !text-muted-foreground",
          closeButton: "!border-border !bg-card !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
