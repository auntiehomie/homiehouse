# Hypersnap production failover

During the November 13 shard stall, use `https://haatz.quilibrium.com` as the temporary production upstream. Set the production-only `MY_HYPERSNAP_NODE_URL` override in Vercel and redeploy the current production revision. Check `NEXT_PUBLIC_HYPERSNAP_URL` separately because browser and signer routes use it directly. Preserve Preview settings when changing Production.

Check fresh feeds and profiles in production. Use a test account to submit a signed cast, reply, and quote cast, and read each back by hash. A successful `/v1/info` response establishes RPC availability and reports shard progress.

Restore the prior production override after `rpc.homiehouse.xyz` shows all shards advancing and the same read and write checks pass. During recovery, compare heights against a synced Hypersnap reference. If data shards report `fork block event is not committed on shard zero yet`, check the required event against shard 0 before deciding whether snapshot recovery is needed.
