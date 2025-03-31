import type {LayoutMap, Variable as ConfigVariable, DependentGroup, ImageVariable} from "../types/layoutConfigTypes";
import type {Doc} from "../types/docStateTypes";

export type ValidationReport = {
    removedLayoutIds: string[];
    removedVariables: string[];
    removedDependents: {variableId: string, imageVariableId: string}[];
    removedVariableValues: {value: string, imageVariableId: string, dependentGroupIndex: number}[];
};

export function layoutMappingValidation(layoutMap: LayoutMap, doc: Doc): {
    cleanLayoutMap: LayoutMap,
    report: ValidationReport
} {
    // Create a deep copy of the layoutMap to avoid mutating the original
    const cleanLayoutMap: LayoutMap = JSON.parse(JSON.stringify(layoutMap));
    
    // Initialize the validation report
    const report: ValidationReport = {
        removedLayoutIds: [],
        removedVariables: [],
        removedDependents: [],
        removedVariableValues: []
    };
    
    // Create sets of existing IDs for faster lookup
    const existingLayoutIds = new Set(doc.layouts.map(layout => layout.id));
    const existingVariableIds = new Set(doc.variables.map(variable => variable.id));
    
    // 1. Check layoutIds against doc.layouts
    cleanLayoutMap.layoutIds = cleanLayoutMap.layoutIds.filter(layoutId => {
        const exists = existingLayoutIds.has(layoutId);
        if (!exists) {
            report.removedLayoutIds.push(layoutId);
        }
        return exists;
    });
    
    // 2. Check variables against doc.variables and process their dependent groups
    cleanLayoutMap.variables = cleanLayoutMap.variables.filter(imageVariable => {
        console.log("ADGA");
        // Check if the image variable ID exists in doc.variables
        const imageVariableExists = imageVariable.id ? existingVariableIds.has(imageVariable.id) : false;
        
        if (!imageVariableExists && imageVariable.id) {
            report.removedVariables.push(imageVariable.id);
            return false;
        }
        
        // Process dependent groups even if the image variable exists
        processImageVariableDependentGroups(imageVariable, existingVariableIds, report);
        
        return imageVariableExists || !imageVariable.id;
    });
    
    return {
        cleanLayoutMap,
        report
    };
}

function processImageVariableDependentGroups(
    imageVariable: ImageVariable, 
    existingVariableIds: Set<string>, 
    report: ValidationReport
): void {
    // Process each dependent group
    imageVariable.dependentGroup = imageVariable.dependentGroup.filter((group, groupIndex) => {
        // 3. Check dependents.variableId against doc.variables
        group.dependents = group.dependents.filter(dependent => {
            const dependentExists = existingVariableIds.has(dependent.variableId);
            if (!dependentExists) {
                report.removedDependents.push({
                    variableId: dependent.variableId,
                    imageVariableId: imageVariable.id || 'unknown'
                });
            }
            return dependentExists;
        });
        
        // 4. Check variableValue (Variable types) against doc.variables
        group.variableValue = group.variableValue.filter(value => {
            // If it's a string, keep it
            if (typeof value === 'string') {
                return true;
            }
            
            // If it's a Variable type, check if the ID exists
            const variableValue = value as ConfigVariable;
            const valueExists = variableValue.id ? existingVariableIds.has(variableValue.id) : true;
            
            if (!valueExists && variableValue.id) {
                report.removedVariableValues.push({
                    value: variableValue.id,
                    imageVariableId: imageVariable.id || 'unknown',
                    dependentGroupIndex: groupIndex
                });
            }
            
            return valueExists;
        });
        
        // Keep the group if it has dependents or variableValues
        return group.dependents.length > 0 || group.variableValue.length > 0;
    });
}