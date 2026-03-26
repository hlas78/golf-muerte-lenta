import Image from "next/image";

export default function LogoMark({ size = 48 }) {
  return (
    <Image
      src="/logo.png"
      alt="Golf Muerte Rápida"
      width={size}
      height={size}
      style={{ borderRadius: 12 }}
      priority
    />
  );
}
