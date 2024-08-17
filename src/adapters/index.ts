import { inchAdapter, InchAdapter } from "./inch";
import { tsbsAdapter, TSBSAdapter } from "./tsbs";
import { goAdapter, GoAdapter } from "./go";
import { artilleryAdapter, ArtilleryAdapter } from "./artillery";
import { tinybenchAdapter, TinybenchAdapter } from "./tinybench";
import { Config } from "../config";
import { BenchmarkAdapter } from "../types";
import { z } from "zod";

type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? A
  : B;

type NullAdapter = BenchmarkAdapter<"null", z.AnyZodObject>;

export type Adapter<T extends Config["benchmark"]["tool"]> = IfEquals<
  T,
  InchAdapter["tool"],
  InchAdapter,
  IfEquals<
    T,
    GoAdapter["tool"],
    GoAdapter,
    IfEquals<
      T,
      TSBSAdapter["tool"],
      TSBSAdapter,
      IfEquals<
        T,
        ArtilleryAdapter["tool"],
        ArtilleryAdapter,
        IfEquals<T, TinybenchAdapter["tool"], TinybenchAdapter, NullAdapter>
      >
    >
  >
>;

export const adapters = [
  inchAdapter,
  tsbsAdapter,
  goAdapter,
  artilleryAdapter,
  tinybenchAdapter,
] as const;
