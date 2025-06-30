from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd # Still useful if you use pandas for other data handling or display
import datetime

# Assuming you have get_onboard_all and other db utilities defined in servertest.py
from servertest import (
    get_onboard_all,
    insert_onboard_request,
    update_onboard_request,
    delete_onboard_request,
    get_onboard_request_by_id,
    tasks_db, # Import the global in-memory tasks_db
    find_task_by_id, # Import task helper functions
    remove_task_by_id,
    update_task_in_db_list,
    manage_onboarding_tasks,
    CF_SP_Emp_Detail_Search
)

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- GET All Submissions ---
@app.route('/api/submissions', methods=['GET'])
def get_submissions():
    print("Received request for all submissions.")
    try:
        onboard_data = get_onboard_all()
        # Convert DataFrame to a list of dictionaries for JSON serialization
        if not onboard_data.empty:
            return jsonify(onboard_data.to_dict(orient='records')), 200
        else:
            return jsonify({"message": "No submissions found"}), 200
    except Exception as e:
        print(f"Error in get_submissions route: {e}")
        return jsonify({"error": "Internal server error"}), 500

# --- GET Submission by ID ---
@app.route('/api/submissions/<int:submission_id>', methods=['GET'])
def get_submission_by_id(submission_id):
    print(f"Received request for submission with ID: {submission_id}")
    try:
        submission = get_onboard_request_by_id(submission_id)
        if submission:
            # Convert datetime objects in the dictionary to string for JSON serialization
            for key, value in submission.items():
                if isinstance(value, (datetime.datetime, datetime.date)):
                    submission[key] = value.isoformat()
            return jsonify(submission), 200
        else:
            return jsonify({"message": f"Submission with ID {submission_id} not found"}), 404
    except Exception as e:
        print(f"Error in get_submission_by_id route: {e}")
        return jsonify({"error": "Internal server error"}), 500

# --- CREATE Operation ---
@app.route('/api/submissions', methods=['POST'])
def add_submission():
    print("Received request to ADD submission.")
    request_data = request.json
    if not request_data:
        return jsonify({"error": "Invalid data: Request body must be JSON"}), 400

    try:
        # Call the modified insert_onboard_request which returns the new ID
        new_submission_id = insert_onboard_request(request_data)

        if new_submission_id:
            # Fetch the full newly inserted record to pass to task manager
            full_new_submission_data = get_onboard_request_by_id(new_submission_id)
            if full_new_submission_data:
                manage_onboarding_tasks(full_new_submission_data) # Run task check
                return jsonify({
                    "message": "Submission added successfully and tasks managed",
                    "id": new_submission_id,
                    "received_data": request_data
                }), 201
            else:
                return jsonify({"error": f"Failed to retrieve new submission {new_submission_id} after insert."}), 500
        else:
            return jsonify({"error": "Failed to add submission to the database."}), 500
    except Exception as e:
        print(f"Error in add_submission route: {e}")
        return jsonify({"error": f"Internal server error during addition: {e}"}), 500

# --- UPDATE Operation ---
@app.route('/api/submissions/<int:submission_id>', methods=['PUT'])
def update_submission(submission_id):
    print(f"Received request to UPDATE submission with ID: {submission_id}")
    update_data = request.json
    if not update_data:
        return jsonify({"error": "Invalid data: Request body must be JSON"}), 400

    try:
        update_successful = update_onboard_request(submission_id, update_data)

        if update_successful:
            # Fetch the full updated record to pass to task manager
            updated_onboard_data_from_db = get_onboard_request_by_id(submission_id)
            if updated_onboard_data_from_db:
                manage_onboarding_tasks(updated_onboard_data_from_db) # Run task check
                return jsonify({"message": f"Submission {submission_id} updated successfully and tasks managed"}), 200
            else:
                return jsonify({"error": f"Submission {submission_id} updated but failed to retrieve for task management."}), 500
        else:
            return jsonify({"error": f"Failed to update submission {submission_id}. It might not exist or data was invalid."}), 404
    except Exception as e:
        print(f"Error in update_submission route: {e}")
        return jsonify({"error": "Internal server error during update"}), 500

# --- DELETE Operation ---
@app.route('/api/submissions/<int:submission_id>', methods=['DELETE'])
def delete_submission(submission_id):
    print(f"Received request to DELETE submission with ID: {submission_id}")

    try:
        success = delete_onboard_request(submission_id)

        if success:
            return jsonify({"message": f"Submission {submission_id} deleted successfully"}), 200
        else:
            return jsonify({"error": f"Failed to delete submission {submission_id}. It might not exist."}), 404
    except Exception as e:
        print(f"Error in delete_submission route: {e}")
        return jsonify({"error": "Internal server error during deletion"}), 500

# --- Task-specific Endpoints (Now interacting with servertest.py's in-memory tasks_db) ---

@app.route('/api/tasks', methods=['GET'])
def get_all_tasks():
    """Returns all tasks currently in the in-memory database."""
    print("Received request for all tasks.")
    # tasks_db is now imported from servertest.py
    return jsonify(tasks_db), 200

@app.route('/api/tasks/<string:task_id>', methods=['GET'])
def get_task_by_id(task_id):
    """Returns a single task by its composite string ID."""
    print(f"Received request for task with ID: {task_id}")
    task = find_task_by_id(task_id) # Call helper from servertest.py
    if task:
        return jsonify(task), 200
    return jsonify({"message": "Task not found"}), 404

@app.route('/api/tasks/<string:task_id>', methods=['PUT'])
def update_task_status(task_id):
    """Updates the status or other details of a specific task."""
    print(f"Received request to UPDATE task with ID: {task_id}")
    update_data = request.json
    if not update_data:
        return jsonify({"error": "Invalid data: Request body must be JSON"}), 400

    task_obj = find_task_by_id(task_id) # Call helper from servertest.py
    if task_obj:
        # update_task_in_db_list modifies the object in place
        success = update_task_in_db_list(task_obj, update_data)
        if success:
            return jsonify({"message": f"Task {task_id} updated successfully", "task": task_obj}), 200
        else:
            return jsonify({"error": "Failed to update task"}), 500
    return jsonify({"message": "Task not found"}), 404

@app.route('/api/tasks/<string:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Deletes a task by its composite string ID."""
    print(f"Received request to DELETE task with ID: {task_id}")
    success = remove_task_by_id(task_id) # Call helper from servertest.py
    if success:
        return jsonify({"message": "Task deleted successfully"}), 200
    return jsonify({"message": "Task not found"}), 404

@app.route('/api/employee-search', methods=['GET'])
def search_employees():
    """
    Searches for employee details using the CF_SP_Emp_Detail_Search function
    and returns matching records.
    Expects a 'term' query parameter (e.g., /api/employee-search?term=john).
    If 'term' is empty, it will be passed as an empty string to the search function.
    """
    search_term = request.args.get('term', '') # Default to empty string instead of None

    print(f"Received employee search request for term: '{search_term}'")
    if search_term:
        try:
            # Call the Python function to execute the stored procedure
            # The CF_SP_Emp_Detail_Search function is expected to handle empty strings
            employee_df = CF_SP_Emp_Detail_Search(search_term=search_term)

            if not employee_df.empty:
                # Convert DataFrame to a list of dictionaries for JSON response
                employees_list = employee_df.to_dict(orient='records')
                print(f"Found {len(employees_list)} employee(s) for term '{search_term}'.")
                return jsonify(employees_list), 200
            else:
                print(f"No employees found for term '{search_term}'.")
                return jsonify({"message": "No matching employees found"}), 404
        except Exception as e:
            print(f"Error during employee search: {e}")
            return jsonify({"message": f"An error occurred during search: {str(e)}"}), 500
    else:
        return jsonify({"message": "please enter params"}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)