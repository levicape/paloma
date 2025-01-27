import http from "node:http";

const server = http.createServer({ keepAliveTimeout: 60000 }, (req, res) => {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			data: "Hello World!",
		}),
	);
});

const port = 9222;
const ttl = Math.random() * 8000 + 6;
server.listen(9222);
console.dir(
	{
		message: "Server listening",
		port,
		ttl,
	},
	{ depth: null },
);
setTimeout(() => {
	server.close(() => {
		console.dir(
			{
				message: "Server closed",
			},
			{ depth: null },
		);
	});
}, ttl);
