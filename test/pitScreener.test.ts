import assert from "node:assert/strict";
import { it } from "node:test";
import * as nt from "../src/generated/ntSdk.generated.ts";
it("composes typed native disclosure sources into a saved PIT screen",()=>{
  const manager=nt.updateInstitutionalWatchlist({watchlistKey:"manager",managerCik:"1067983"});
  const insider=nt.updateInsiderWatchlist({watchlistKey:"insider",windowDays:45,role:"Officer"});
  const action=nt.updateScreenerWatchlist({watchlistKey:"screen",refreshMinutes:1440,
    columns:[nt.screenColumn("value",nt.screenDisclosure(manager.source)),nt.screenColumn("buys",nt.screenDisclosure(insider.source)),nt.screenColumn("price",nt.screenPrice())],
    filter:nt.screenAll(nt.screenCompare("price","Gte",5),nt.screenCompare("buys","Gt",0)),selection:nt.screenPercentile("value",10)});
  const wire=JSON.parse(JSON.stringify(action)) as nt.UpdateWatchlistAction;
  assert.equal(wire.source.type,"Screener");assert.equal(action.source.columns[0].metric.type,"Disclosure");
  assert.equal(action.source.refreshMinutes,1440);assert.equal(action.source.selection?.type,"Percentile");
  assert.ok(!("output" in wire));assert.ok(!("windowDays" in manager.source));
});
