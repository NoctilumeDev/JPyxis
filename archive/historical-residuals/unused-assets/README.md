# Unused Assets

This directory is a classification boundary, not a trash folder.

An asset becomes a deletion candidate only when all of the following are true:

1. it is not referenced by source, documentation, build/release configuration, manifests, digests,
   tests, receipts, or review records;
2. it is not an original failure, observation, or user decision input;
3. the current product fully supersedes it; and
4. removing it does not change any claimed evidence coordinate.

No asset meets all four conditions with sufficient evidence in the first archive pass, so nothing is
placed here and nothing is deleted.
