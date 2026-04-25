import { motion } from "motion/react";

export type Props = {
	searchValue: string;
};

export function ResultsPane({ searchValue }: Props) {
	return (
		<motion.div
			key="results-pane"
			class="fixed h-dvh w-full top-0 left-0 z-30 pt-16 bg-white"
			initial={{ opacity: 0, top: -5 }}
			animate={{ opacity: 1, top: 0, transition: { duration: 0.08 } }}
			exit={{ opacity: 0, top: 0, transition: { duration: 0.08 } }}
		>
			{searchValue}
		</motion.div>
	);
}
