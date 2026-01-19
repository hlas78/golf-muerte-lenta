import Image from "next/image";

export default function LogoMark({ size = 48 }) {
  return (
    <Image
      src="/logoML.jpeg"
      alt="Golf Muerte Lenta"
      width={size}
      height={size}
      style={{ borderRadius: 12 }}
      priority
    />
  );
}
