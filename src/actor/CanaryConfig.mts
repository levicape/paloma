// import { Config } from "effect"

// class FilesystemConfig {
//   constructor(
//     readonly host: string,
//     readonly port: number,
//     readonly timeout: number
//   ) {}
//   get url() {
//     return `${this.host}:${this.port}`
//   }
// }

// const filesystemConfig = Config.all([
//   Config.string("HOST"),
//   Config.number("PORT")
// ])

// const serviceConfig = Config.map(
//   Config.all([
//     Config.nested(filesystemConfig, "PALOMA_REPOSITORY"),
//   ]),
//   ([[host, port], timeout]) => new ServiceConfig(host, port, timeout)
// )
// PALOMA_CANARY_HANDLER_CONCURRENCY default 1
