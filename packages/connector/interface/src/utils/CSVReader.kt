package io.tellery.utils

import com.github.doyaaaaaken.kotlincsv.dsl.csvReader
import io.tellery.entities.TypeField
import java.sql.Types
import java.time.LocalDate
import java.time.LocalDateTime


fun readCSV(content: ByteArray): CSVData {
    var ret: CSVData? = null
    csvReader().open(content.inputStream()) {
        readAllAsSequence().forEach { row ->
            if (ret == null) {
                // handle row conversion
                ret = CSVData(row)
            } else {
                ret!!.records.add(row)
                //initialize dataTypes by the first row
                var initialized = false
                row.forEachIndexed { index, item ->
                    when {
                        item.toFloatOrNull() != null -> {
                            ret!!.setDataType(index, Types.FLOAT, initialized)
                        }
                        isDateTime(item) -> {
                            ret!!.setDataType(index, Types.TIMESTAMP, initialized)
                        }
                        isDate(item) -> {
                            ret!!.setDataType(index, Types.DATE, initialized)
                        }
                        item.lowercase() in listOf("true", "false") -> {
                            ret!!.setDataType(index, Types.BOOLEAN, initialized)
                        }
                        else -> {
                            ret!!.setDataType(index, Types.VARCHAR, initialized)
                        }
                    }
                }
                if (!initialized) {
                    initialized = true
                }
            }

        }
    }
    return ret ?: throw Exception("Parsing CSV Error")
}


// Assume that all csv files have header
class CSVData(rawHeader: List<String>) {
    // handle header parsing
    val header: List<String> = rawHeader.map{
        it.replace('-', '_')
            .replace(' ', '_')
            .replace('.', '_')
    }
    val records: MutableList<List<String>> = mutableListOf()
    private val dataTypes: Array<Int> = Array(header.size) { -1 }

    val fields: List<TypeField>
        get() = header.zip(this.dataTypes.toList()).map{ (name, type) -> TypeField(name, type)}

    fun setDataType(index: Int, targetSQLType: Int, initialized: Boolean = true): Unit {
        if (initialized && dataTypes[index] != -1 && dataTypes[index] != targetSQLType) {
            dataTypes[index] = Types.VARCHAR
        } else {
            dataTypes[index] = targetSQLType
        }
    }
}

fun isDateTime(s: String): Boolean {
    return try {
        LocalDateTime.parse(s, formatter)
        true
    } catch (e: Exception) {
        false
    }
}

fun isDate(s: String): Boolean {
    return try {
        LocalDate.parse(s, formatter)
        true
    } catch (e: Exception) {
        false
    }
}
