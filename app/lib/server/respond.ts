import { connection } from "next/server";

export const ok = (data: unknown) => Response.json(data);
export const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

/** Opts a GET handler out of prerendering; the store and chain change between requests. */
export const live = () => connection();
