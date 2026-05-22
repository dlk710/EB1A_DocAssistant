import type { SVGProps } from "react";

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function BookmarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1z" />
    </IconBase>
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </IconBase>
  );
}

export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
      <path d="M9 11h6" />
      <path d="M6 4h12l1 3H5l1-3z" />
    </IconBase>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </IconBase>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </IconBase>
  );
}

export function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3z" />
      <path d="M18.5 13l.7 1.8L21 15.5l-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
      <path d="M5.5 14l.9 2.1L8.5 17l-2.1.9-.9 2.1-.9-2.1L2.5 17l2.1-.9.9-2.1z" />
    </IconBase>
  );
}

export function ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 14l6-6 6 6" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 10l6 6 6-6" />
    </IconBase>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </IconBase>
  );
}

export function DotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="6" cy="6" r="5" />
    </svg>
  );
}

export function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
