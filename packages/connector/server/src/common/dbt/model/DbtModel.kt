package io.tellery.common.dbt.model

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import io.tellery.grpc.DbtBlock

@JsonIgnoreProperties(ignoreUnknown = true)
data class DbtModel(
    @JsonProperty("raw_sql") val rawSql: String?,
    @JsonProperty("compiled_sql") val compiledSql: String?,
    @JsonProperty("resource_type") val resourceType: String,
    @JsonProperty("relation_name") val relationName: String?,
    @JsonProperty("source_name") val sourceName: String?,
    @JsonProperty("unique_id") val uniqueId: String,
    val name: String,
    val database: String,
    val schema: String,
    val description: String,
    val config: Config,
    val path: String?
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    data class Config(
        val enabled: Boolean,
        val materialized: String?
    )

    fun toDbtBlock(): DbtBlock {
        val builder = DbtBlock.newBuilder()
            .setType(if (resourceType == "model") DbtBlock.Type.MODEL else DbtBlock.Type.SOURCE)
            .setName(name)
            .setUniqueId(uniqueId)
            .setDescription(description)

        if (rawSql != null) builder.rawSql = rawSql
        if (compiledSql != null) builder.compiledSql = compiledSql
        if (config.materialized != null) builder.materialized = when (config.materialized) {
            "view" -> DbtBlock.Materialization.VIEW
            "table" -> DbtBlock.Materialization.TABLE
            "incremental" -> DbtBlock.Materialization.INCREMENTAL
            "ephemeral" -> DbtBlock.Materialization.EPHEMERAL
            else -> DbtBlock.Materialization.UNKNOWN
        }

        if (sourceName != null) builder.sourceName = sourceName
        // Relation name is null when the materialized of table is ephemeral
        if (relationName != null) builder.relationName = relationName
        return builder.build()
    }
}
