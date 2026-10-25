# Ask Homie topic research

Ask Homie searches public casts through the existing Hypersnap search adapter before generating topic answers. The dedicated Explain in plain English and Build me a lesson paths now perform the same retrieval; previously they returned before the general agent's research path.

The educator combines the chosen topic, the last two learner messages and an available public cast excerpt. Prior assistant output is excluded from the search query. It retrieves KB material, public casts and optional Brave web results concurrently. KB or web lookup failures do not discard the other sources. Topic research uses the existing configured primary and fallback Hypersnap nodes.

Cast queries strip question boilerplate and use at most three searches of five results each, plus five recent casts from an explicitly mentioned account. Results are deduplicated and capped at ten. Network School questions include shorter phrase searches. This is bounded keyword retrieval over the node's search index, not exhaustive protocol scanning, semantic search, or proof that every relevant post has been found.

Social results enter the model as untrusted attributed claims, never instructions or independent verification. Empty results must not be used to deny an event. The general agent no longer discards useful web/KB evidence simply because cast search is empty. The response metadata records provider, query list, result count and source links. The chat renders related-post excerpts with internal links to cast detail. Only valid protocol hashes produce links. No private mailbox messages are queried.

`liveWebVerified` remains false: retrieving a web page is not independent verification. Optional Brave search continues to depend on its existing server configuration.

## Validation

Regression tests cover both educator modes without an attached cast, combined KB/web/social context, exclusion of assistant output from search, empty-result behavior, generic-topic routing, shorter Network School queries and validated cast links. Chat browser fixtures exercise source rendering at 390, 820 and 1280px. Fixtures do not establish live LLM/DB/provider correctness.
