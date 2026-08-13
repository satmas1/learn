#!/usr/bin/env python3
"""
Backend API tests for curriculum expansion bug fix.
Tests that all 10 strands (5 per grade) are properly seeded and accessible.
"""

import requests
import os
import sys
from typing import Dict, List, Any

# Base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://adaptive-learn-191.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

def test_dashboard_strands():
    """
    Test 1: GET /api/dashboard
    - Expect HTTP 200
    - JSON with strands array of length 10
    - 5 strands with grade 8, 5 strands with grade 9
    - All expected strand codes present
    - Each strand has nodes.length > 0
    """
    print("\n" + "="*80)
    print("TEST 1: GET /api/dashboard - Verify 10 strands (5 per grade)")
    print("="*80)
    
    try:
        response = requests.get(f"{API_URL}/dashboard", timeout=10)
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        strands = data.get('strands', [])
        
        print(f"✓ Total strands: {len(strands)}")
        
        if len(strands) != 10:
            print(f"✗ FAILED: Expected 10 strands, got {len(strands)}")
            return False
        
        # Group by grade
        grade8_strands = [s for s in strands if s.get('grade') == 8]
        grade9_strands = [s for s in strands if s.get('grade') == 9]
        
        print(f"✓ Grade 8 strands: {len(grade8_strands)}")
        print(f"✓ Grade 9 strands: {len(grade9_strands)}")
        
        if len(grade8_strands) != 5:
            print(f"✗ FAILED: Expected 5 Grade 8 strands, got {len(grade8_strands)}")
            return False
        
        if len(grade9_strands) != 5:
            print(f"✗ FAILED: Expected 5 Grade 9 strands, got {len(grade9_strands)}")
            return False
        
        # Check expected strand codes
        expected_codes = [
            'MTH8-B', 'MTH8-C', 'MTH8-D', 'MTH8-E', 'MTH8-F',
            'MTH1W-B', 'MTH1W-C', 'MTH1W-D', 'MTH1W-E', 'MTH1W-F'
        ]
        
        actual_codes = [s.get('code') for s in strands]
        print(f"\n✓ Strand codes found: {sorted(actual_codes)}")
        
        missing_codes = set(expected_codes) - set(actual_codes)
        if missing_codes:
            print(f"✗ FAILED: Missing strand codes: {missing_codes}")
            return False
        
        print(f"✓ All expected strand codes present")
        
        # Check each strand has nodes
        for strand in strands:
            nodes = strand.get('nodes', [])
            code = strand.get('code')
            name = strand.get('name')
            node_count = len(nodes)
            
            print(f"  - {code} ({name}): {node_count} nodes")
            
            if node_count == 0:
                print(f"✗ FAILED: Strand {code} has no nodes")
                return False
        
        print("\n✅ TEST 1 PASSED: Dashboard returns 10 strands with correct structure")
        return True
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_new_nodes():
    """
    Test 2: GET /api/nodes/<id> for new nodes
    - Test at least one node from each new strand
    - Expect HTTP 200
    - JSON contains node, strand, mastery
    - node.widget must be non-null with 'kind' field
    """
    print("\n" + "="*80)
    print("TEST 2: GET /api/nodes/<id> - Verify new nodes from expanded strands")
    print("="*80)
    
    # New nodes to test (one from each new strand)
    test_nodes = [
        ('g8-percent-basic', 'MTH8-D', 'Data Literacy (Grade 8)'),
        ('g8-angle-acute', 'MTH8-E', 'Spatial Sense (Grade 8)'),
        ('g8-discount-percent', 'MTH8-F', 'Financial Literacy (Grade 8)'),
        ('g9-relative-freq', 'MTH1W-D', 'Data (Grade 9)'),
        ('g9-angle-acute', 'MTH1W-E', 'Geometry & Measurement (Grade 9)'),
        ('g9-simple-interest', 'MTH1W-F', 'Financial Literacy (Grade 9)'),
    ]
    
    all_passed = True
    
    for node_id, expected_strand_code, expected_strand_name in test_nodes:
        print(f"\n--- Testing node: {node_id} ---")
        
        try:
            response = requests.get(f"{API_URL}/nodes/{node_id}", timeout=10)
            print(f"✓ Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"✗ FAILED: Expected 200, got {response.status_code}")
                print(f"Response: {response.text}")
                all_passed = False
                continue
            
            data = response.json()
            
            # Check node exists
            node = data.get('node')
            if not node:
                print(f"✗ FAILED: No 'node' in response")
                all_passed = False
                continue
            
            print(f"✓ Node found: {node.get('title')}")
            
            # Check strand exists
            strand = data.get('strand')
            if not strand:
                print(f"✗ FAILED: No 'strand' in response")
                all_passed = False
                continue
            
            strand_code = strand.get('code')
            strand_name = strand.get('name')
            print(f"✓ Strand: {strand_code} - {strand_name}")
            
            if strand_code != expected_strand_code:
                print(f"✗ FAILED: Expected strand code {expected_strand_code}, got {strand_code}")
                all_passed = False
                continue
            
            # Check mastery exists
            mastery = data.get('mastery')
            if not mastery:
                print(f"✗ FAILED: No 'mastery' in response")
                all_passed = False
                continue
            
            print(f"✓ Mastery: pMastery={mastery.get('pMastery')}, mastered={mastery.get('mastered')}")
            
            # Check widget exists and has 'kind' field
            widget = node.get('widget')
            if not widget:
                print(f"✗ FAILED: Node has no 'widget' field")
                all_passed = False
                continue
            
            widget_kind = widget.get('kind')
            if not widget_kind:
                print(f"✗ FAILED: Widget has no 'kind' field")
                all_passed = False
                continue
            
            valid_kinds = ['NumberLineMarker', 'FractionBar', 'LinearGraphMatcher']
            if widget_kind not in valid_kinds:
                print(f"✗ FAILED: Invalid widget kind '{widget_kind}', expected one of {valid_kinds}")
                all_passed = False
                continue
            
            print(f"✓ Widget kind: {widget_kind}")
            print(f"✅ Node {node_id} passed all checks")
            
        except Exception as e:
            print(f"✗ FAILED: Exception occurred: {str(e)}")
            import traceback
            traceback.print_exc()
            all_passed = False
    
    if all_passed:
        print("\n✅ TEST 2 PASSED: All new nodes accessible with correct structure")
    else:
        print("\n✗ TEST 2 FAILED: Some nodes failed validation")
    
    return all_passed


def test_bkt_mastery_update():
    """
    Test 3: POST /api/attempts with BKT mastery tracking
    - Test with g8-percent-basic node
    - Submit 3 correct attempts
    - Verify mastery increases monotonically
    """
    print("\n" + "="*80)
    print("TEST 3: POST /api/attempts - Verify BKT mastery tracking")
    print("="*80)
    
    node_id = 'g8-percent-basic'
    print(f"Testing BKT updates for node: {node_id}")
    
    try:
        mastery_values = []
        
        for attempt_num in range(1, 4):
            print(f"\n--- Attempt {attempt_num} ---")
            
            payload = {
                "nodeId": node_id,
                "correct": True
            }
            
            response = requests.post(f"{API_URL}/attempts", json=payload, timeout=10)
            print(f"✓ Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"✗ FAILED: Expected 200, got {response.status_code}")
                print(f"Response: {response.text}")
                return False
            
            data = response.json()
            mastery = data.get('mastery')
            
            if not mastery:
                print(f"✗ FAILED: No 'mastery' in response")
                return False
            
            previous_p = mastery.get('previousP')
            current_p = mastery.get('pMastery')
            
            print(f"✓ Previous pMastery: {previous_p:.4f}")
            print(f"✓ Current pMastery: {current_p:.4f}")
            print(f"✓ Increase: {(current_p - previous_p):.4f}")
            
            mastery_values.append(current_p)
            
            # Check that mastery increased
            if current_p <= previous_p:
                print(f"✗ FAILED: Mastery did not increase (previous={previous_p}, current={current_p})")
                return False
            
            print(f"✓ Mastery increased correctly")
        
        # Check monotonic increase
        print(f"\n--- Checking monotonic increase ---")
        print(f"Mastery progression: {[f'{v:.4f}' for v in mastery_values]}")
        
        for i in range(1, len(mastery_values)):
            if mastery_values[i] <= mastery_values[i-1]:
                print(f"✗ FAILED: Mastery not monotonically increasing at position {i}")
                return False
        
        print(f"✓ Mastery is monotonically increasing")
        print("\n✅ TEST 3 PASSED: BKT mastery tracking works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_practice_questions():
    """
    Test 4: GET /api/practice/<nodeId>?count=5
    - Test with g8-angle-acute
    - Expect HTTP 200
    - questions array length 5
    - Each question has prompt, choices, id, nodeId
    """
    print("\n" + "="*80)
    print("TEST 4: GET /api/practice/<nodeId> - Verify practice question generation")
    print("="*80)
    
    node_id = 'g8-angle-acute'
    count = 5
    
    print(f"Testing practice questions for node: {node_id}")
    print(f"Requesting {count} questions")
    
    try:
        response = requests.get(f"{API_URL}/practice/{node_id}?count={count}", timeout=10)
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        questions = data.get('questions', [])
        
        print(f"✓ Questions received: {len(questions)}")
        
        if len(questions) != count:
            print(f"✗ FAILED: Expected {count} questions, got {len(questions)}")
            return False
        
        # Validate each question structure
        for i, q in enumerate(questions, 1):
            print(f"\n--- Question {i} ---")
            
            q_id = q.get('id')
            prompt = q.get('prompt')
            choices = q.get('choices')
            q_node_id = q.get('nodeId')
            
            if not q_id:
                print(f"✗ FAILED: Question missing 'id'")
                return False
            print(f"✓ ID: {q_id}")
            
            if not prompt:
                print(f"✗ FAILED: Question missing 'prompt'")
                return False
            print(f"✓ Prompt: {prompt[:60]}...")
            
            if not choices or not isinstance(choices, list):
                print(f"✗ FAILED: Question missing 'choices' array")
                return False
            print(f"✓ Choices: {len(choices)} options")
            
            if q_node_id != node_id:
                print(f"✗ FAILED: Question nodeId mismatch (expected {node_id}, got {q_node_id})")
                return False
            print(f"✓ NodeId: {q_node_id}")
        
        print("\n✅ TEST 4 PASSED: Practice questions generated correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAILED: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def check_schema_version():
    """
    Check if schema version reseed happened automatically.
    If dashboard still returns old data, may need manual reseed.
    """
    print("\n" + "="*80)
    print("PRELIMINARY CHECK: Schema version and reseed status")
    print("="*80)
    
    try:
        response = requests.get(f"{API_URL}/dashboard", timeout=10)
        
        if response.status_code != 200:
            print(f"⚠ Warning: Dashboard returned {response.status_code}")
            return False
        
        data = response.json()
        strands = data.get('strands', [])
        
        print(f"Current strand count: {len(strands)}")
        
        if len(strands) < 10:
            print(f"⚠ WARNING: Only {len(strands)} strands found (expected 10)")
            print(f"Schema version reseed may not have fired automatically")
            print(f"Attempting manual reseed via POST /api/seed...")
            
            seed_response = requests.post(f"{API_URL}/seed", json={}, timeout=10)
            
            if seed_response.status_code == 200:
                print(f"✓ Manual reseed successful")
                
                # Re-check dashboard
                recheck = requests.get(f"{API_URL}/dashboard", timeout=10)
                if recheck.status_code == 200:
                    new_data = recheck.json()
                    new_strands = new_data.get('strands', [])
                    print(f"✓ After reseed: {len(new_strands)} strands")
                    
                    if len(new_strands) == 10:
                        print(f"✅ Reseed successful - now have 10 strands")
                        return True
                    else:
                        print(f"✗ Reseed did not fix the issue")
                        return False
            else:
                print(f"✗ Manual reseed failed: {seed_response.status_code}")
                return False
        else:
            print(f"✓ Schema version reseed appears to have worked automatically")
            return True
            
    except Exception as e:
        print(f"✗ Error checking schema version: {str(e)}")
        return False


def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("BACKEND API TESTS - Curriculum Expansion Bug Fix")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    
    # Check schema version first
    schema_ok = check_schema_version()
    
    if not schema_ok:
        print("\n⚠ WARNING: Schema version check indicated potential issues")
        print("Proceeding with tests anyway...\n")
    
    # Run all tests
    results = {
        'Dashboard Strands': test_dashboard_strands(),
        'New Nodes': test_new_nodes(),
        'BKT Mastery': test_bkt_mastery_update(),
        'Practice Questions': test_practice_questions(),
    }
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("="*80)
        return 0
    else:
        print("✗ SOME TESTS FAILED")
        print("="*80)
        return 1


if __name__ == '__main__':
    sys.exit(main())
