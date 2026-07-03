# Model Routing

Model-level cost/quality optimization — choosing which model to call, how many samples to draw, and when to escalate — as a layer distinct from token compression.

## Subcategories

* [Batch-Aware Routing](/techniques/model-routing/batch-aware-routing/) - Amortize repeated system/tool prompt tokens by batching multiple queries into one call and routing at batch level (Batch Prompting, RoBatch).
* [Cascade Routing](/techniques/model-routing/cascade-routing/) - Try the cheap model first and escalate only when a quality/confidence estimator rejects the cheap answer (FrugalGPT, Cascade Routing, C3PO).
* [Compound & Productized Routers](/techniques/model-routing/compound-and-productized-routers/overview.md) - Shipped products that route or coordinate multiple models behind one endpoint; concrete dossiers live under competition/.
* [Decode-Time Routing](/techniques/model-routing/decode-time-routing/) - Speculative decoding and decode-time methods that cut self-hosted latency but not billable API tokens.
* [Full Ensembling](/techniques/model-routing/full-ensembling/) - Always fan out to multiple models per query to maximize quality — a token/cost-increasing quality play, not a saver (LLM-Blender, MoA, Self-MoA).
* [Pre-Call Routing](/techniques/model-routing/pre-call-routing/) - Choose the cheapest capable model before generation using a query-scoring router (RouteLLM, Hybrid LLM, OptLLM, UniRoute).
* [Routing Research](/techniques/model-routing/routing-research/) - Second-generation routing research on failure modes basic routers miss — budget ceilings, routing collapse, and router evaluation (ParetoBandit, EquiRouter, RouteJudge, R2-Router).
* [Selective Ensembling](/techniques/model-routing/selective-ensembling/) - Use ensemble or best-of-n only when the marginal quality gain beats the added cost (BEST-Route, RoBoN, Zooter).

## Documents

* [Model-Level Optimization Landscape (Routing / Ensemble / Cascade / Decode)](/techniques/model-routing/overview.md) - Model-level cost/quality optimization — choosing which model to call, how many samples to draw, and when to escalate — as a layer distinct from token compression.
