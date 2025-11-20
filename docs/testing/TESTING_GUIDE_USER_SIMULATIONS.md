# 🧪 Testing Guide - User Simulation Access

## 🎯 **Testing Objectives**

Verify that all authenticated users can:
1. Create simulations for their own rounds
2. Control simulations (start, pause, reset, rerun)
3. See only their own rounds
4. Receive real-time updates via WebSocket
5. Handle errors gracefully

## 📋 **Test Scenarios**

### **Test 1: Basic User Simulation Flow**

**Steps:**
1. Create a new user account (non-admin)
2. Navigate to Matchups page
3. Select a contest
4. Make picks and submit a round
5. Navigate to Live page
6. Verify pending rounds are visible
7. Click "Start Simulation"
8. Verify simulation starts
9. Test pause/resume
10. Test speed adjustment
11. Wait for simulation to finish
12. Verify results are displayed

**Expected Results:**
- ✅ User can see their pending rounds
- ✅ User can create simulation
- ✅ User can control simulation
- ✅ User sees only their own rounds
- ✅ Simulation completes successfully

---

### **Test 2: Multiple Users Viewing Same Simulation**

**Steps:**
1. Create 2+ user accounts
2. Each user submits rounds for the same contest
3. User 1 creates a simulation
4. User 2 navigates to Live page with simulation ID in URL
5. Both users view the same simulation
6. User 1 pauses the simulation
7. Verify User 2 sees the pause in real-time
8. User 1 resumes the simulation
9. Verify User 2 sees the resume in real-time

**Expected Results:**
- ✅ Multiple users can view same simulation
- ✅ Each user sees only their own rounds
- ✅ Actions by one user update all users in real-time
- ✅ WebSocket updates work correctly

---

### **Test 3: Admin Changes Propagate to Users**

**Steps:**
1. Admin creates a contest
2. User submits rounds for the contest
3. User creates a simulation
4. Admin modifies contest/matchups in admin panel
5. Verify user sees updates in real-time

**Expected Results:**
- ✅ Admin changes broadcast to all users
- ✅ Users see updates without refresh
- ✅ No conflicts or errors

---

### **Test 4: Error Handling - No Authentication**

**Steps:**
1. Log out
2. Navigate to Live page
3. Try to create simulation

**Expected Results:**
- ✅ User is redirected to login
- ✅ Clear error message shown
- ✅ No crashes or errors

---

### **Test 5: Error Handling - No Pending Rounds**

**Steps:**
1. Log in as user
2. Navigate to Live page
3. Verify no pending rounds message
4. Try to create simulation

**Expected Results:**
- ✅ Clear message: "No pending rounds to simulate"
- ✅ Helpful guidance to submit rounds first
- ✅ No crashes

---

### **Test 6: Error Handling - Network Failure**

**Steps:**
1. Log in as user
2. Submit rounds
3. Disconnect network
4. Try to create simulation
5. Reconnect network
6. Try again

**Expected Results:**
- ✅ Clear network error message
- ✅ Retry guidance provided
- ✅ Works after reconnection
- ✅ No data loss

---

### **Test 7: Edge Case - Simulation Already Running**

**Steps:**
1. User creates and starts simulation
2. User tries to create another simulation
3. Verify confirmation dialog
4. Confirm reset
5. Verify new simulation created

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ User can cancel or proceed
- ✅ Reset works correctly
- ✅ New simulation created successfully

---

### **Test 8: Edge Case - Rerun Simulation**

**Steps:**
1. User creates simulation
2. Simulation runs to completion
3. Click "Rerun" button
4. Verify simulation resets
5. Verify new simulation created automatically

**Expected Results:**
- ✅ Simulation resets correctly
- ✅ New simulation created with same contest
- ✅ All rounds included
- ✅ Simulation starts successfully

---

### **Test 9: Edge Case - Speed Adjustment**

**Steps:**
1. User creates simulation
2. Start simulation
3. Change speed to 60x
4. Verify simulation speeds up
5. Change speed to 1x
6. Verify simulation slows down

**Expected Results:**
- ✅ Speed changes apply immediately
- ✅ No errors or crashes
- ✅ Simulation continues correctly

---

### **Test 10: Edge Case - User Has No Rounds**

**Steps:**
1. Create new user account
2. Navigate to Live page
3. Verify empty state
4. Verify helpful message

**Expected Results:**
- ✅ Empty state shown
- ✅ Clear message: "No pending rounds"
- ✅ Link to Matchups page
- ✅ No errors

---

## 🔍 **Regression Testing**

### **Verify Admin Features Still Work:**
- [ ] Admin can create contests
- [ ] Admin can see all pending entries
- [ ] Admin can create simulations from admin panel
- [ ] Admin can control simulations
- [ ] Admin sees all rounds (not just their own)

### **Verify Existing Features Still Work:**
- [ ] Matchups page works
- [ ] Results page works
- [ ] User dashboard works
- [ ] Authentication works
- [ ] Bankroll updates work

---

## 🐛 **Common Issues to Watch For**

1. **WebSocket Connection Issues**:
   - Check browser console for connection errors
   - Verify WebSocket URL is correct
   - Check CORS settings

2. **Round Filtering Issues**:
   - Verify users only see their own rounds
   - Check `userId` matching logic
   - Verify admin sees all rounds

3. **Error Message Issues**:
   - Verify error messages are user-friendly
   - Check error handling doesn't crash app
   - Verify network errors are handled

4. **Real-time Update Issues**:
   - Verify updates appear immediately
   - Check WebSocket events are received
   - Verify no duplicate updates

---

## ✅ **Success Criteria**

All tests pass when:
- ✅ Users can create and control simulations
- ✅ Users see only their own rounds
- ✅ Real-time updates work correctly
- ✅ Error handling is graceful
- ✅ Edge cases are handled
- ✅ Admin features still work
- ✅ No regressions in existing features

---

## 📝 **Test Results Template**

```
Test #: [Number]
Date: [Date]
Tester: [Name]
Status: [Pass/Fail]

Steps Taken:
1. [Step]
2. [Step]
...

Results:
- [Result]
- [Result]

Issues Found:
- [Issue description]

Notes:
[Additional notes]
```

---

## 🚀 **Ready for Production When:**

- ✅ All test scenarios pass
- ✅ No critical bugs found
- ✅ Error handling works correctly
- ✅ Real-time updates work reliably
- ✅ Performance is acceptable
- ✅ User experience is smooth
