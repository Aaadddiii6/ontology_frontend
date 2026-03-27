"use client";
import React, { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

const CountUp: React.FC<{
  value: number;
  decimals?: number;
  duration?: number;
}> = ({ value, decimals = 0, duration = 1.5 }) => {
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const output = useTransform(spring, (current) => {
    return current.toFixed(decimals);
  });

  return <motion.span>{output}</motion.span>;
};

export default CountUp;
