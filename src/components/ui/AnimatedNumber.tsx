import React, { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export const AnimatedNumber: React.FC<{ value: string | number }> = ({
  value,
}) => {
  const strVal = String(value);
  const numMatch = strVal.match(/[\d.]+/);

  if (!numMatch) return <span>{value}</span>;

  const numVal = parseFloat(numMatch[0]);
  if (isNaN(numVal)) return <span>{value}</span>;

  const prefix = strVal.substring(0, numMatch.index);
  const suffix = strVal.substring(numMatch.index! + numMatch[0].length);
  const hasDecimals = numMatch[0].includes(".");

  return (
    <CountUp value={numVal} prefix={prefix} suffix={suffix} hasDecimals={hasDecimals} />
  );
};

const CountUp: React.FC<{
  value: number;
  prefix: string;
  suffix: string;
  hasDecimals: boolean;
}> = ({ value, prefix, suffix, hasDecimals }) => {
  const spring = useSpring(0, { stiffness: 100, damping: 20 });
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const output = useTransform(spring, (current) => {
    let fmt = hasDecimals ? current.toFixed(1) : Math.round(current).toString();
    return prefix + fmt + suffix;
  });

  return <motion.span>{output}</motion.span>;
};
