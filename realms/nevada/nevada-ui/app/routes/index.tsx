import { clsx } from "clsx";
import type { Context } from "hono";
import { OidcUserLoginCard } from "../atoms/authentication/card/$OidcUserLoginCard";
import { AppBody } from "../ui/AppBody";
import { ApplicationHead } from "../variant/ApplicationHead";

export default function Home(_c: Context) {
	return (
		<AppBody>
			(
			<main className={clsx("hero", "pt-2", "pb-12", "min-h-36")}>
				<article
					className={clsx(
						"hero-content",
						"text-left",
						"sm:max-w-10/12",
						"md:max-w-3/4",
						"lg:max-w-11/12",
					)}
				>
					<section className={clsx("md:pr-4", "lg:pr-8")}>
						<h1
							className={clsx(
								"text-3xl",
								"font-bold",
								"text-primary-content",
								"mb-3",
							)}
						>
							{ApplicationHead.title.default}
						</h1>
						<ul>
							{ApplicationHead.description.map((description) => {
								return (
									<li
										key={`${description.slice(-16)}${description.slice(16)}`}
										className={clsx(
											"text-md",
											"font-semibold",
											"text-secondary-content",
											"leading-tight",
											"pb-3",
										)}
									>
										{description}
									</li>
								);
							})}
						</ul>
					</section>
					<OidcUserLoginCard />
				</article>
			</main>
			)
		</AppBody>
	);
}
