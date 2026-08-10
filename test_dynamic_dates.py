#!/usr/bin/env python3
"""
Focused test for dynamic invoice dates behavior
Tests that failure_date, next_attempt_date, and attempt_history are dynamically computed
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import calendar

# Backend URL from frontend/.env
BASE_URL = "https://secure-checkout-89.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(name):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def log_pass(msg):
    print(f"{Colors.GREEN}✓ PASS: {msg}{Colors.RESET}")

def log_fail(msg):
    print(f"{Colors.RED}✗ FAIL: {msg}{Colors.RESET}")

def log_info(msg):
    print(f"{Colors.YELLOW}ℹ INFO: {msg}{Colors.RESET}")

def add_one_month(d):
    """Add one month to a date, matching backend logic"""
    month = d.month + 1
    year = d.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return d.replace(year=year, month=month, day=day)

def test_dynamic_invoice_dates():
    """Test that invoice dates are dynamically computed based on today's date"""
    log_test("Dynamic Invoice Dates - failure_date, next_attempt_date, attempt_history")
    
    # Step 1: POST /api/auth/verify
    log_info("Step 1: POST /api/auth/verify with phone='0612345678', email='datecheck.demo@example.com'")
    verify_url = f"{BASE_URL}/auth/verify"
    verify_payload = {
        "phone": "0612345678",
        "email": "datecheck.demo@example.com"
    }
    
    try:
        verify_response = requests.post(verify_url, json=verify_payload, timeout=30)
        log_info(f"Status Code: {verify_response.status_code}")
        
        if verify_response.status_code != 200:
            log_fail(f"Expected status 200, got {verify_response.status_code}")
            log_info(f"Response: {verify_response.text}")
            return False
        
        verify_data = verify_response.json()
        token = verify_data.get("token")
        invoice_id = verify_data.get("invoice_id")
        
        if not token or not invoice_id:
            log_fail("Missing token or invoice_id in response")
            return False
        
        log_pass(f"Got token and invoice_id: {invoice_id}")
        
        # Step 2: GET /api/invoices/{invoice_id}
        log_info(f"Step 2: GET /api/invoices/{invoice_id}")
        invoice_url = f"{BASE_URL}/invoices/{invoice_id}"
        headers = {"Authorization": f"Bearer {token}"}
        
        invoice_response = requests.get(invoice_url, headers=headers, timeout=30)
        log_info(f"Status Code: {invoice_response.status_code}")
        
        if invoice_response.status_code != 200:
            log_fail(f"Expected status 200, got {invoice_response.status_code}")
            log_info(f"Response: {invoice_response.text}")
            return False
        
        invoice_data = invoice_response.json()
        log_info(f"Invoice data: {json.dumps(invoice_data, indent=2)}")
        
        # Get today's date for comparison
        today = datetime.now()
        today_date_str = today.strftime("%Y-%m-%d")
        expected_failure_date = today.replace(hour=8, minute=30, second=0, microsecond=0).strftime("%Y-%m-%dT08:30:00")
        expected_next_attempt = add_one_month(today).strftime("%Y-%m-%d")
        
        log_info(f"Today's date: {today_date_str}")
        log_info(f"Expected failure_date: {expected_failure_date}")
        log_info(f"Expected next_attempt_date: {expected_next_attempt}")
        
        all_checks_passed = True
        
        # Check 1: Sanity checks (label, amount, iban_masked)
        log_info("\n--- Sanity Checks ---")
        
        if invoice_data.get("label") != "Box Internet Wi-Fi":
            log_fail(f"Label mismatch: expected 'Box Internet Wi-Fi', got '{invoice_data.get('label')}'")
            all_checks_passed = False
        else:
            log_pass(f"Label correct: {invoice_data.get('label')}")
        
        if invoice_data.get("amount") != 39.99:
            log_fail(f"Amount mismatch: expected 39.99, got {invoice_data.get('amount')}")
            all_checks_passed = False
        else:
            log_pass(f"Amount correct: {invoice_data.get('amount')}")
        
        if invoice_data.get("iban_masked") != "FR76 XXXX XXXX XXXX XXXX XXXX XXX":
            log_fail(f"IBAN masked mismatch: expected 'FR76 XXXX XXXX XXXX XXXX XXXX XXX', got '{invoice_data.get('iban_masked')}'")
            all_checks_passed = False
        else:
            log_pass(f"IBAN masked correct: {invoice_data.get('iban_masked')}")
        
        # Check 2: failure_date
        log_info("\n--- Dynamic Date Checks ---")
        
        actual_failure_date = invoice_data.get("failure_date")
        log_info(f"Actual failure_date: {actual_failure_date}")
        
        if not actual_failure_date:
            log_fail("failure_date is missing")
            all_checks_passed = False
        else:
            # Check if it matches today's date with time 08:30:00
            if actual_failure_date != expected_failure_date:
                log_fail(f"failure_date mismatch: expected '{expected_failure_date}', got '{actual_failure_date}'")
                all_checks_passed = False
            else:
                log_pass(f"failure_date is correct: {actual_failure_date} (TODAY at 08:30)")
            
            # Verify the date part is today
            actual_date_part = actual_failure_date.split("T")[0]
            if actual_date_part != today_date_str:
                log_fail(f"failure_date date part is not today: expected {today_date_str}, got {actual_date_part}")
                all_checks_passed = False
            else:
                log_pass(f"failure_date date part is today: {actual_date_part}")
            
            # Verify the time part is exactly 08:30:00
            actual_time_part = actual_failure_date.split("T")[1] if "T" in actual_failure_date else ""
            if actual_time_part != "08:30:00":
                log_fail(f"failure_date time part is not 08:30:00: got {actual_time_part}")
                all_checks_passed = False
            else:
                log_pass(f"failure_date time part is correct: {actual_time_part}")
        
        # Check 3: next_attempt_date
        actual_next_attempt = invoice_data.get("next_attempt_date")
        log_info(f"Actual next_attempt_date: {actual_next_attempt}")
        
        if not actual_next_attempt:
            log_fail("next_attempt_date is missing")
            all_checks_passed = False
        else:
            if actual_next_attempt != expected_next_attempt:
                log_fail(f"next_attempt_date mismatch: expected '{expected_next_attempt}' (TODAY + 1 month), got '{actual_next_attempt}'")
                all_checks_passed = False
            else:
                log_pass(f"next_attempt_date is correct: {actual_next_attempt} (TODAY + 1 month)")
        
        # Check 4: attempt_history
        log_info("\n--- Attempt History Checks ---")
        
        attempt_history = invoice_data.get("attempt_history", [])
        log_info(f"Attempt history entries: {len(attempt_history)}")
        
        if not attempt_history:
            log_fail("attempt_history is empty")
            all_checks_passed = False
        else:
            log_info(f"Attempt history: {json.dumps(attempt_history, indent=2)}")
            
            # Check that all entries have time 08:30
            for i, entry in enumerate(attempt_history):
                entry_date = entry.get("date", "")
                log_info(f"Entry {i}: date={entry_date}")
                
                if "T" not in entry_date:
                    log_fail(f"Entry {i}: date format invalid (no 'T' separator): {entry_date}")
                    all_checks_passed = False
                    continue
                
                time_part = entry_date.split("T")[1] if "T" in entry_date else ""
                if time_part != "08:30:00":
                    log_fail(f"Entry {i}: time is not 08:30:00, got {time_part}")
                    all_checks_passed = False
                else:
                    log_pass(f"Entry {i}: time is correct (08:30:00)")
            
            # Check that the most recent entry (first in list) has today's date
            if len(attempt_history) > 0:
                most_recent = attempt_history[0]
                most_recent_date = most_recent.get("date", "")
                most_recent_date_part = most_recent_date.split("T")[0] if "T" in most_recent_date else ""
                
                if most_recent_date_part != today_date_str:
                    log_fail(f"Most recent attempt date is not today: expected {today_date_str}, got {most_recent_date_part}")
                    all_checks_passed = False
                else:
                    log_pass(f"Most recent attempt date is today: {most_recent_date_part}")
            
            # Check that entries are 5 days apart (going backwards)
            if len(attempt_history) > 1:
                log_info("Checking 5-day intervals between attempts...")
                for i in range(len(attempt_history) - 1):
                    current_date_str = attempt_history[i].get("date", "").split("T")[0]
                    next_date_str = attempt_history[i + 1].get("date", "").split("T")[0]
                    
                    try:
                        current_date = datetime.strptime(current_date_str, "%Y-%m-%d")
                        next_date = datetime.strptime(next_date_str, "%Y-%m-%d")
                        diff = (current_date - next_date).days
                        
                        if diff != 5:
                            log_fail(f"Interval between entry {i} and {i+1} is {diff} days, expected 5 days")
                            all_checks_passed = False
                        else:
                            log_pass(f"Interval between entry {i} and {i+1} is correct: 5 days")
                    except Exception as e:
                        log_fail(f"Error parsing dates for interval check: {e}")
                        all_checks_passed = False
        
        if all_checks_passed:
            log_pass("\n✓ ALL DYNAMIC DATE CHECKS PASSED")
            return True
        else:
            log_fail("\n✗ SOME DYNAMIC DATE CHECKS FAILED")
            return False
        
    except Exception as e:
        log_fail(f"Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}DYNAMIC INVOICE DATES TEST{Colors.RESET}")
    print(f"{Colors.BLUE}Backend URL: {BASE_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    result = test_dynamic_invoice_dates()
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST RESULT{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    if result:
        print(f"{Colors.GREEN}✓ DYNAMIC DATE TEST PASSED{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.RED}✗ DYNAMIC DATE TEST FAILED{Colors.RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
