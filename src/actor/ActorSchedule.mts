export class ActorSchedule {
	private continue = true;

	static context(of: ActorSchedule) {
		return {
			continue: of.continue,
		};
	}

	async proceed() {
		const previous = this.continue;
		this.continue = true;
		return previous;
	}

	async next(check: () => Promise<boolean> = async () => false) {
		this.continue = await check();
	}
}
