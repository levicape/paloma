// app/global.d.ts
import type {} from 'hono'

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>): Response | Promise<Response>
  }
}
