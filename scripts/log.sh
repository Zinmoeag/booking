#!/bin/bash

LOG_DIR="../logger"
APP_LOG_FILE="info.log"
REPORT_FILE="../logger/log_analysis_report.txt"

LOG_LEVELS=("error" "nfo")

echo "analyzing $LOG_DIR/$APP_LOG_FILE" > "$REPORT_FILE"
echo "============================================================================" >> "$REPORT_FILE" 

echo -e "\nList of log files updated in the last 1 day:" >> "$REPORT_FILE" 
LOG_FILES=$(find "$LOG_DIR" -name "*.log" -type f -mtime -1)

echo -e "\nList of error logs:" >> "$REPORT_FILE" 
echo $LOG_FILES
for LOG_FILE in $LOG_FILES; do
    echo "=================================================================================" >> "$REPORT_FILE"  
    echo "============================= $LOG_DIR/$APP_LOG_FILE ===================================" >> "$REPORT_FILE"  
    echo "=================================================================================" >> "$REPORT_FILE"  
    echo -e "\n$LOG_FILE: $LOG_DIR/$APP_LOG_FILE" >> "$REPORT_FILE"  
    for LOG_LEVEL in "${LOG_LEVELS[@]}"; do
        ERROR_COUNT=$(grep -c "$LOG_LEVEL" "$LOG_FILE")
        echo -e "\n$LOG_LEVEL in $LOG_FILE: count $ERROR_COUNT" >> "$REPORT_FILE"
        grep "$LOG_LEVEL" "$LOG_FILE" >> "$REPORT_FILE"  

        if [ "$ERROR_COUNT" -gt 5 ]; then
           echo -e "\n Action required: $LOG_FILE has $ERROR_COUNT $LOG_LEVEL logs" >> "$REPORT_FILE"
        fi
    done
done

echo "Analysis complete!" >> "$REPORT_FILE"  
echo "Analysis complete!"  # Keep this for terminal output