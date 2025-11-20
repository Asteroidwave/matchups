# Mixed Matchup Validation Rules

## Overview

Mixed matchups combine connections from different roles (jockey, trainer, sire) and/or different tracks. The validation rules ensure fair and interesting matchups while preventing invalid combinations.

## Rule Flowchart

```
┌─────────────────────────────────────┐
│   Start: Validate Mixed Matchup    │
│   (Set A vs Set B)                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Check: Do sets share any horses?   │
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         │           │
        Yes          No
         │           │
         ▼           ▼
    ┌────────┐  ┌─────────────────────────────────┐
    │ REJECT │  │ Check: Are sets from different  │
    │   ❌   │  │ tracks? (no track overlap)      │
    └────────┘  └──────────────┬──────────────────┘
                               │
                         ┌─────┴─────┐
                         │           │
                        Yes          No
                         │           │
                         ▼           ▼
                    ┌────────┐  ┌─────────────────────────────────┐
                    │ ACCEPT │  │ Check: Do sets have different   │
                    │   ✅   │  │ roles? (no role overlap)        │
                    └────────┘  └──────────────┬──────────────────┘
                                               │
                                         ┌─────┴─────┐
                                         │           │
                                        Yes          No
                                         │           │
                                         ▼           ▼
                                    ┌────────┐  ┌────────┐
                                    │ ACCEPT │  │ REJECT │
                                    │   ✅   │  │   ❌   │
                                    └────────┘  └────────┘
```

## Detailed Rules

### Rule 1: Horse Overlap Check (Always Applied)

**Condition**: Do Set A and Set B share any horses?

**Logic**:
```typescript
// Collect all horses from both sets
const horsesA = Set A connections → all starters → horse names
const horsesB = Set B connections → all starters → horse names

// Check for intersection
if (horsesA ∩ horsesB ≠ ∅) {
  return REJECT; // Horse overlap found
}
```

**Why**: A horse cannot compete against itself. This ensures each matchup is fair and makes logical sense.

### Rule 2: Different Tracks (Cross-Track Matchups)

**Condition**: Are Set A and Set B from completely different tracks?

**Logic**:
```typescript
// Collect all tracks from both sets
const tracksA = Set A connections → all trackSet values
const tracksB = Set B connections → all trackSet values

// Check for no overlap
if (tracksA ∩ tracksB = ∅) {
  return ACCEPT; // Different tracks, roles can be same
}
```

**Why**: When connections are from different tracks, they're competing in different contexts. Same roles are allowed because they're not directly competing in the same races.

**Examples**:
- ✅ Jockey from Track A vs Jockey from Track B
- ✅ Trainer from Track A vs Trainer from Track C
- ✅ Sire from Track B vs Sire from Track A

### Rule 3: Same Track, Different Roles

**Condition**: If sets share at least one track, do they have different roles?

**Logic**:
```typescript
// Collect all roles from both sets
const rolesA = Set A connections → all role values
const rolesB = Set B connections → all role values

// Check for no overlap
if (rolesA ∩ rolesB = ∅) {
  return ACCEPT; // Same track but different roles
} else {
  return REJECT; // Same track and same role
}
```

**Why**: When connections are from the same track, having the same role would mean they're directly competing in the same context. Different roles ensure variety and prevent redundancy with single-role matchup types.

**Examples**:
- ✅ Jockey vs Trainer (same track)
- ✅ Trainer vs Sire (same track)
- ✅ Jockey vs Sire (same track)
- ❌ Jockey vs Jockey (same track) - use jockey_vs_jockey instead
- ❌ Trainer vs Trainer (same track) - use trainer_vs_trainer instead
- ❌ Sire vs Sire (same track) - use sire_vs_sire instead

## Examples

### Example 1: Valid Cross-Track, Same Role

```
Set A:
  - Jockey "John Smith" (Track: DEL, Salary: 5000)
  
Set B:
  - Jockey "Jane Doe" (Track: SA, Salary: 5100)

Validation:
  1. Horse overlap? No ✅
  2. Different tracks? Yes (DEL ≠ SA) ✅
  
Result: ACCEPT ✅
```

### Example 2: Valid Same-Track, Different Roles

```
Set A:
  - Jockey "John Smith" (Track: DEL, Salary: 5000)
  
Set B:
  - Trainer "Bob Johnson" (Track: DEL, Salary: 5100)

Validation:
  1. Horse overlap? No ✅
  2. Different tracks? No (both DEL)
  3. Different roles? Yes (Jockey ≠ Trainer) ✅
  
Result: ACCEPT ✅
```

### Example 3: Invalid Same-Track, Same Role

```
Set A:
  - Jockey "John Smith" (Track: DEL, Salary: 5000)
  
Set B:
  - Jockey "Jane Doe" (Track: DEL, Salary: 5100)

Validation:
  1. Horse overlap? No ✅
  2. Different tracks? No (both DEL)
  3. Different roles? No (both Jockey) ❌
  
Result: REJECT ❌
Reason: Same track, same role - should use jockey_vs_jockey type instead
```

### Example 4: Invalid Horse Overlap

```
Set A:
  - Jockey "John Smith" (Track: DEL, Horses: ["Horse A", "Horse B"])
  
Set B:
  - Trainer "Bob Johnson" (Track: DEL, Horses: ["Horse B", "Horse C"])

Validation:
  1. Horse overlap? Yes ("Horse B" in both) ❌
  
Result: REJECT ❌
Reason: Horse overlap detected
```

### Example 5: Valid Multi-Connection Sets

```
Set A:
  - Jockey "John Smith" (Track: DEL, Salary: 3000)
  - Trainer "Bob Johnson" (Track: SA, Salary: 2000)
  
Set B:
  - Sire "Secretariat" (Track: GP, Salary: 5100)

Validation:
  1. Horse overlap? No ✅
  2. Different tracks? Yes (DEL, SA vs GP, no overlap) ✅
  
Result: ACCEPT ✅
```

## Implementation Notes

### Connection Structure

Each connection has:
- `role`: "jockey" | "trainer" | "sire"
- `trackSet`: string[] (array of track codes)
- `starters`: Starter[] (array of horse appearances)

### Track Codes

Common track codes:
- DEL: Delaware Park
- SA: Santa Anita
- GP: Gulfstream Park
- CD: Churchill Downs
- BEL: Belmont Park
- etc.

### Performance Considerations

- All checks use Set operations for O(n) complexity
- Horse overlap check is performed first (most likely to fail)
- Track and role checks are only performed if horse overlap passes
- Efficient for both single and multi-connection sets

## Testing Scenarios

### Test Case 1: Cross-Track Same Role
```typescript
const setA = [{ role: 'jockey', trackSet: ['DEL'], starters: [...] }];
const setB = [{ role: 'jockey', trackSet: ['SA'], starters: [...] }];
// Expected: ACCEPT
```

### Test Case 2: Same-Track Different Role
```typescript
const setA = [{ role: 'jockey', trackSet: ['DEL'], starters: [...] }];
const setB = [{ role: 'trainer', trackSet: ['DEL'], starters: [...] }];
// Expected: ACCEPT
```

### Test Case 3: Same-Track Same Role
```typescript
const setA = [{ role: 'jockey', trackSet: ['DEL'], starters: [...] }];
const setB = [{ role: 'jockey', trackSet: ['DEL'], starters: [...] }];
// Expected: REJECT
```

### Test Case 4: Horse Overlap
```typescript
const setA = [{ role: 'jockey', trackSet: ['DEL'], starters: [{ horseName: 'Horse A' }] }];
const setB = [{ role: 'trainer', trackSet: ['DEL'], starters: [{ horseName: 'Horse A' }] }];
// Expected: REJECT
```

### Test Case 5: Multi-Track Overlap
```typescript
const setA = [{ role: 'jockey', trackSet: ['DEL', 'SA'], starters: [...] }];
const setB = [{ role: 'jockey', trackSet: ['SA', 'GP'], starters: [...] }];
// Expected: REJECT (SA overlap, same role)
```

### Test Case 6: Multi-Track Overlap Different Roles
```typescript
const setA = [{ role: 'jockey', trackSet: ['DEL', 'SA'], starters: [...] }];
const setB = [{ role: 'trainer', trackSet: ['SA', 'GP'], starters: [...] }];
// Expected: ACCEPT (SA overlap but different roles)
```

## FAQ

**Q: Why allow same roles across different tracks?**  
A: Different tracks represent different competitive contexts. A jockey at Delaware Park vs a jockey at Santa Anita are competing in completely different races, so comparing them is interesting and valid.

**Q: Why reject same roles on the same track?**  
A: If both connections are jockeys on the same track, that matchup should be in the "jockey_vs_jockey" type instead. Mixed matchups are meant to combine different types of connections or connections from different contexts.

**Q: What if a connection appears in multiple tracks?**  
A: The validation checks for any track overlap. If there's even one shared track and the roles are the same, the matchup is rejected.

**Q: Can I have a 2v2 matchup with mixed roles?**  
A: Yes! As long as the validation rules pass. For example:
- Set A: [Jockey from DEL, Trainer from SA]
- Set B: [Sire from GP, Jockey from CD]
- This would be valid if there's no horse overlap and tracks are all different.

**Q: What about scratched or AE horses?**  
A: All horses in the starters array are checked for overlap, regardless of their scratched or AE status. This ensures complete validation.

---

**Last Updated**: 2025-11-13  
**Version**: 1.0



