#!/usr/bin/env python3
"""
Backend API tests for SFR Espace Client
Tests the new verification flow and payment endpoints
"""

import requests
import json
import sys
from datetime import datetime

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

def test_auth_verify_valid():
    """Test POST /api/auth/verify with valid phone and email"""
    log_test("POST /api/auth/verify - Valid credentials")
    
    url = f"{BASE_URL}/auth/verify"
    payload = {
        "phone": "0612345678",
        "email": "test.demo@example.com"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        log_info(f"Status Code: {response.status_code}")
        log_info(f"Response: {response.text[:500]}")
        
        if response.status_code != 200:
            log_fail(f"Expected status 200, got {response.status_code}")
            return None, None
        
        data = response.json()
        
        # Verify response structure
        if "token" not in data:
            log_fail("Response missing 'token' field")
            return None, None
        if not data["token"]:
            log_fail("Token is empty")
            return None, None
        log_pass(f"Token received: {data['token'][:20]}...")
        
        if "user" not in data:
            log_fail("Response missing 'user' field")
            return None, None
        if "id" not in data["user"] or "email" not in data["user"]:
            log_fail("User object missing id or email")
            return None, None
        log_pass(f"User received: id={data['user']['id']}, email={data['user']['email']}")
        
        if "invoice_id" not in data:
            log_fail("Response missing 'invoice_id' field")
            return None, None
        if not data["invoice_id"]:
            log_fail("invoice_id is empty")
            return None, None
        log_pass(f"Invoice ID received: {data['invoice_id']}")
        
        log_pass("POST /api/auth/verify with valid credentials - ALL CHECKS PASSED")
        return data["token"], data["invoice_id"]
        
    except Exception as e:
        log_fail(f"Exception occurred: {str(e)}")
        return None, None

def test_auth_verify_invalid_phone():
    """Test POST /api/auth/verify with invalid phone (too short)"""
    log_test("POST /api/auth/verify - Invalid phone (too short)")
    
    url = f"{BASE_URL}/auth/verify"
    payload = {
        "phone": "12",
        "email": "x@y.com"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        log_info(f"Status Code: {response.status_code}")
        log_info(f"Response: {response.text[:500]}")
        
        if response.status_code != 422:
            log_fail(f"Expected status 422 for invalid phone, got {response.status_code}")
            return False
        
        log_pass("POST /api/auth/verify with invalid phone - Correctly returned 422")
        return True
        
    except Exception as e:
        log_fail(f"Exception occurred: {str(e)}")
        return False

def test_get_invoice(token, invoice_id):
    """Test GET /api/invoices/{invoice_id} with authorization"""
    log_test(f"GET /api/invoices/{invoice_id} - Verify invoice details")
    
    url = f"{BASE_URL}/invoices/{invoice_id}"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        log_info(f"Status Code: {response.status_code}")
        log_info(f"Response: {response.text[:1000]}")
        
        if response.status_code != 200:
            log_fail(f"Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify label
        expected_label = "Box Internet Wi-Fi"
        if data.get("label") != expected_label:
            log_fail(f"Expected label '{expected_label}', got '{data.get('label')}'")
            return False
        log_pass(f"Label correct: {data['label']}")
        
        # Verify amount
        expected_amount = 39.99
        if data.get("amount") != expected_amount:
            log_fail(f"Expected amount {expected_amount}, got {data.get('amount')}")
            return False
        log_pass(f"Amount correct: {data['amount']}")
        
        # Verify status
        expected_status = "unpaid"
        if data.get("status") != expected_status:
            log_fail(f"Expected status '{expected_status}', got '{data.get('status')}'")
            return False
        log_pass(f"Status correct: {data['status']}")
        
        # Verify IBAN masked - CRITICAL: must be exactly "FR76 XXXX XXXX XXXX XXXX XXXX XXX"
        expected_iban = "FR76 XXXX XXXX XXXX XXXX XXXX XXX"
        if data.get("iban_masked") != expected_iban:
            log_fail(f"Expected IBAN '{expected_iban}', got '{data.get('iban_masked')}'")
            return False
        log_pass(f"IBAN masked correct: {data['iban_masked']}")
        
        # Verify failure_reason exists
        if "failure_reason" not in data:
            log_fail("Missing 'failure_reason' field")
            return False
        log_pass(f"Failure reason present: {data['failure_reason']}")
        
        log_pass("GET /api/invoices/{invoice_id} - ALL CHECKS PASSED")
        return True
        
    except Exception as e:
        log_fail(f"Exception occurred: {str(e)}")
        return False

def test_payment_success(token, invoice_id):
    """Test POST /api/payments/card with success card"""
    log_test("POST /api/payments/card - Success card (4242 4242 4242 4242)")
    
    url = f"{BASE_URL}/payments/card"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "invoice_id": invoice_id,
        "card_number": "4242 4242 4242 4242",
        "card_holder": "JEAN DUPONT",
        "expiry": "12/30",
        "cvv": "123"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        log_info(f"Status Code: {response.status_code}")
        log_info(f"Response: {response.text[:1000]}")
        
        if response.status_code != 200:
            log_fail(f"Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify status is success
        if data.get("status") != "success":
            log_fail(f"Expected status 'success', got '{data.get('status')}'")
            return False
        log_pass(f"Payment status: {data['status']}")
        
        # Verify card_last4
        if data.get("card_last4") != "4242":
            log_fail(f"Expected card_last4 '4242', got '{data.get('card_last4')}'")
            return False
        log_pass(f"Card last 4 digits correct: {data['card_last4']}")
        
        # Now verify invoice is marked as paid
        log_info("Verifying invoice status changed to 'paid'...")
        invoice_url = f"{BASE_URL}/invoices/{invoice_id}"
        inv_response = requests.get(invoice_url, headers=headers, timeout=30)
        
        if inv_response.status_code != 200:
            log_fail(f"Failed to fetch invoice after payment: {inv_response.status_code}")
            return False
        
        inv_data = inv_response.json()
        if inv_data.get("status") != "paid":
            log_fail(f"Invoice status should be 'paid', got '{inv_data.get('status')}'")
            return False
        log_pass(f"Invoice status correctly updated to: {inv_data['status']}")
        
        log_pass("POST /api/payments/card with success card - ALL CHECKS PASSED")
        return True
        
    except Exception as e:
        log_fail(f"Exception occurred: {str(e)}")
        return False

def test_payment_failure():
    """Test POST /api/payments/card with failure card"""
    log_test("POST /api/payments/card - Failure card (4000 0000 0000 0002)")
    
    # First, create a new user with fresh unpaid invoice
    log_info("Creating new user for failure test...")
    verify_url = f"{BASE_URL}/auth/verify"
    verify_payload = {
        "phone": "0698765432",
        "email": "test.fail@example.com"
    }
    
    try:
        verify_response = requests.post(verify_url, json=verify_payload, timeout=30)
        if verify_response.status_code != 200:
            log_fail(f"Failed to create new user: {verify_response.status_code}")
            return False
        
        verify_data = verify_response.json()
        token = verify_data["token"]
        invoice_id = verify_data["invoice_id"]
        log_pass(f"New user created with invoice: {invoice_id}")
        
        # Now attempt payment with failure card
        payment_url = f"{BASE_URL}/payments/card"
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "invoice_id": invoice_id,
            "card_number": "4000 0000 0000 0002",
            "card_holder": "JEAN DUPONT",
            "expiry": "12/30",
            "cvv": "123"
        }
        
        payment_response = requests.post(payment_url, json=payload, headers=headers, timeout=30)
        log_info(f"Status Code: {payment_response.status_code}")
        log_info(f"Response: {payment_response.text[:1000]}")
        
        if payment_response.status_code != 200:
            log_fail(f"Expected status 200, got {payment_response.status_code}")
            return False
        
        payment_data = payment_response.json()
        
        # Verify status is failed
        if payment_data.get("status") != "failed":
            log_fail(f"Expected status 'failed', got '{payment_data.get('status')}'")
            return False
        log_pass(f"Payment status: {payment_data['status']}")
        
        # Verify invoice remains unpaid
        log_info("Verifying invoice status remains 'unpaid'...")
        invoice_url = f"{BASE_URL}/invoices/{invoice_id}"
        inv_response = requests.get(invoice_url, headers=headers, timeout=30)
        
        if inv_response.status_code != 200:
            log_fail(f"Failed to fetch invoice after failed payment: {inv_response.status_code}")
            return False
        
        inv_data = inv_response.json()
        if inv_data.get("status") != "unpaid":
            log_fail(f"Invoice status should remain 'unpaid', got '{inv_data.get('status')}'")
            return False
        log_pass(f"Invoice status correctly remains: {inv_data['status']}")
        
        log_pass("POST /api/payments/card with failure card - ALL CHECKS PASSED")
        return True
        
    except Exception as e:
        log_fail(f"Exception occurred: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}SFR ESPACE CLIENT - BACKEND API TESTS{Colors.RESET}")
    print(f"{Colors.BLUE}Backend URL: {BASE_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    results = {}
    
    # Test 1: Valid verification
    token, invoice_id = test_auth_verify_valid()
    results["auth_verify_valid"] = (token is not None and invoice_id is not None)
    
    # Test 2: Invalid phone verification
    results["auth_verify_invalid_phone"] = test_auth_verify_invalid_phone()
    
    # Only proceed with remaining tests if we have valid token and invoice_id
    if token and invoice_id:
        # Test 3: Get invoice details
        results["get_invoice"] = test_get_invoice(token, invoice_id)
        
        # Test 4: Payment success
        results["payment_success"] = test_payment_success(token, invoice_id)
        
        # Test 5: Payment failure
        results["payment_failure"] = test_payment_failure()
    else:
        log_fail("Skipping remaining tests due to auth verification failure")
        results["get_invoice"] = False
        results["payment_success"] = False
        results["payment_failure"] = False
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if result else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"{test_name}: {status}")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.RESET}")
    
    if passed == total:
        print(f"{Colors.GREEN}✓ ALL TESTS PASSED{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.RED}✗ SOME TESTS FAILED{Colors.RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
