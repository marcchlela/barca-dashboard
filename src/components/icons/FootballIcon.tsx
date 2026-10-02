"use client";

import {
  FaFutbol,
} from "react-icons/fa6";

type FootballIconProps = {
  size?: number;
  className?: string;
  title?: string;
};

export default function FootballIcon({
  size = 14,
  className,
  title,
}: FootballIconProps) {
  return (
    <FaFutbol
      size={size}
      className={
        className
      }
      title={title}
      aria-hidden={
        title
          ? undefined
          : true
      }
    />
  );
}