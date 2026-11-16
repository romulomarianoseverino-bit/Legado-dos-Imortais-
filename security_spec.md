# Firebase Security Specification — Legado dos Imortais

## 1. Data Invariants
1. **Zero Blanket PII Exposure:** Personal data (`email`, `linkedLegacyUsername`, privacy preferences) lives exclusively in `/playersPrivate/{userId}` and can only be read or written when `request.auth != null && request.auth.uid == userId && request.auth.token.email_verified == true`.
2. **Public Profile Integrity:** `/playersPublic/{userId}` holds strictly non-PII profile fields (`uid`, `displayName`, `godId`, `wins`, `losses`, timestamps). `uid` must equal `request.auth.uid` and `userId`, and is immutable after creation.
3. **Strict Resource Ownership for Saved 3D Pieces:** Documents in `/players/{userId}/savedPieces/{pieceId}` always enforce `ownerId == request.auth.uid == userId`, bounded strings, valid enum `tipo`, and immutable `createdAt`/`ownerId`/`id`.
4. **Community Board Perimeter Bounds:** Documents in `/communityBoards/{boardId}` always enforce `authorId == request.auth.uid`, `8 <= totalCasas <= 24`, `casas` bounded list matching `totalCasas`, and non-author reads restricted to `resource.data.isPublic == true`.
5. **Server Timestamp Integrity:** Every `create` requires `createdAt == request.time && updatedAt == request.time`; every `update` requires `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Write:** Create `/playersPublic/u1` with `request.auth == null`.
2. **Unverified Email Spoof:** Write `/playersPrivate/u1` where `request.auth.token.email_verified == false`.
3. **Cross-Owner Impersonation:** Authenticated `userA` creates `/playersPublic/userB` or sets `uid: "userB"`.
4. **Shadow Ghost Field Injection:** Create `/playersPublic/userA` with extra field `{ isAdmin: true }` or `{ isPremium: true }`.
5. **Immortal Field Mutation:** Update `/playersPublic/userA` changing `createdAt` or `uid`.
6. **Forged Client Timestamp:** Create `/communityBoards/b1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
7. **ID Poisoning Attack:** Create `/communityBoards/${'x'.repeat(300)}` or invalid characters `../etc/passwd`.
8. **Cross-User PII Read:** Authenticated `userB` executes `getDoc(/playersPrivate/userA)` or lists `/playersPrivate`.
9. **Private Board Scraping:** Authenticated `userB` reads or queries `/communityBoards` where `isPublic == false && authorId == 'userA'`.
10. **Oversized Array / Denial of Wallet:** Create `/communityBoards/b1` with `casas` array length `50` or `totalCasas: 999`.
11. **Value Type Poisoning on Update:** Update `/communityBoards/b1` setting `nome: 12345` or `nome` > 36 chars.
12. **Author Hijack on Subcollection:** `userA` writes `/players/userB/savedPieces/p1` with `ownerId: "userA"`.
